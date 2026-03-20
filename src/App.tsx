import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  where,
  limit
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Thought, ContactType } from './types';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle,
  Send,
  User as UserIcon,
  Plus,
  Trash2,
  MapPin,
  Mail,
  ChevronLeft
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Pensamentos semente — exibidos quando o feed ainda está vazio
// Troque por pensamentos reais dos seus primeiros usuários assim que tiver volume
const SEED_THOUGHTS: Omit<Thought, 'id' | 'uid' | 'contactType' | 'contactValue'>[] = [
  { authorName: 'Lucas', authorCity: 'São Paulo', text: 'Às vezes me pergunto se as pessoas ao redor sabem o quanto eu realmente penso — e aí percebo que nunca digo em voz alta.', createdAt: null },
  { authorName: 'Marina', authorCity: 'Rio de Janeiro', text: 'Saudade de ter tempo livre sem culpa. Só descansar sem pensar no que deveria estar fazendo.', createdAt: null },
  { authorName: 'Alguém', authorCity: 'Curitiba', text: 'Hoje percebi que já faz três meses que não tenho uma conversa de verdade.', createdAt: null },
  { authorName: 'Anon', authorCity: 'Florianópolis', text: 'A solidão mais difícil não é quando você está sozinho. É quando você está cercado de gente e ninguém te vê.', createdAt: null },
  { authorName: 'Clara', authorCity: 'Belo Horizonte', text: 'Queria conseguir explicar o quanto algumas músicas salvam coisas em mim que eu nem sabia que precisavam ser salvas.', createdAt: null },
];

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
const Loading = () => (
  <div className="flex items-center justify-center min-h-screen bg-visto-bg">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
      className="text-5xl font-serif text-visto-wine tracking-tighter"
    >
      visto
    </motion.div>
  </div>
);

// ---------------------------------------------------------------------------
// Splash / Login — a proposta em 3 palavras
// ---------------------------------------------------------------------------
const Login = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request') console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.18 } } };
  const item = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } } };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10">
      <motion.div variants={stagger} initial="hidden" animate="visible" className="text-center max-w-xs w-full">
        <motion.h1 variants={item} className="text-9xl font-serif text-visto-wine tracking-tighter mb-3">
          visto
        </motion.h1>

        <motion.p variants={item} className="text-sm text-visto-muted mb-2 font-light tracking-wide leading-relaxed">
          Você não ganha curtidas aqui.
        </motion.p>
        <motion.p variants={item} className="text-sm text-visto-muted mb-16 font-light tracking-wide leading-relaxed">
          Você ganha conversas.
        </motion.p>

        <motion.button
          variants={item}
          onClick={handleLogin}
          disabled={loading}
          className={`w-full px-10 py-4 bg-visto-wine text-white rounded-full font-medium text-sm tracking-wide transition-all duration-200 visto-btn-shadow active:scale-[0.98] mb-6 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'conectando...' : 'entrar com Google'}
        </motion.button>

        <motion.p variants={item} className="text-[11px] text-visto-muted/50 leading-relaxed">
          sem feed de likes · sem contagem de seguidores<br />só pessoas encontrando pessoas
        </motion.p>
      </motion.div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Onboarding — 3 etapas: pensamento → contato → nome
// A inversão central: o usuário age antes de se cadastrar
// ---------------------------------------------------------------------------
const Onboarding = ({
  user,
  onComplete,
  initialProfile
}: {
  user: User;
  onComplete: (profile: UserProfile) => void;
  initialProfile?: UserProfile | null;
}) => {
  // Se está editando um perfil existente, pula direto para o step de nome
  const startStep = initialProfile ? 2 : 0;
  const [step, setStep] = useState(startStep);
  const [draftThought, setDraftThought] = useState('');
  const [name, setName] = useState(initialProfile?.name || user.displayName || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [contactType, setContactType] = useState<ContactType>(initialProfile?.contactType || 'whatsapp');
  const [contactValue, setContactValue] = useState(initialProfile?.contactValue || '');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === 0 && textareaRef.current) textareaRef.current.focus();
  }, [step]);

  const handleSaveProfile = async () => {
    if (!name.trim() || !contactValue.trim() || saving) return;
    setSaving(true);
    const profile: UserProfile = {
      uid: user.uid,
      name: name.trim(),
      city: city.trim(),
      photoURL: user.photoURL || undefined,
      contactType,
      contactValue: contactValue.trim(),
      createdAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'users', user.uid), profile);
      // Se o usuário escreveu um pensamento no onboarding, publica junto
      if (draftThought.trim() && !initialProfile) {
        await addDoc(collection(db, 'thoughts'), {
          uid: user.uid,
          authorName: profile.name,
          authorCity: profile.city || '',
          authorPhotoURL: profile.photoURL || '',
          text: draftThought.trim(),
          contactType: profile.contactType,
          contactValue: profile.contactValue,
          createdAt: serverTimestamp(),
        });
      }
      onComplete(profile);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const contactLabel: Record<ContactType, string> = {
    whatsapp: 'número do WhatsApp (com +55 e DDD)',
    telegram: 'usuário do Telegram',
    email: 'seu e-mail',
  };
  const contactPlaceholder: Record<ContactType, string> = {
    whatsapp: '+55 51 9 9999-0000',
    telegram: '@seunome',
    email: 'voce@email.com',
  };

  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
    exit: { opacity: 0, y: -12, transition: { duration: 0.3 } },
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center p-10">
      <AnimatePresence mode="wait">

        {/* ── Step 0: Escrever o primeiro pensamento (antes do cadastro) ── */}
        {step === 0 && (
          <motion.div key="step0" {...fadeUp}>
            <p className="text-[11px] uppercase tracking-[0.4em] text-visto-muted font-medium mb-12">
              passo 1 de 3
            </p>
            <h2 className="text-4xl font-serif text-visto-wine tracking-tighter mb-3 leading-tight">
              O que está na sua cabeça agora?
            </h2>
            <p className="text-visto-muted text-sm mb-10 leading-relaxed">
              Escreva livremente. Ninguém vai curtir isso — mas alguém pode se identificar de verdade.
            </p>

            <textarea
              ref={textareaRef}
              value={draftThought}
              onChange={e => setDraftThought(e.target.value)}
              maxLength={180}
              rows={4}
              placeholder="escreva seu pensamento..."
              className="w-full bg-visto-bg-warm border border-visto-wine/10 rounded-2xl p-5 text-visto-text font-serif text-xl font-light tracking-tight leading-relaxed outline-none focus:border-visto-wine/30 transition-all duration-300 resize-none placeholder:text-visto-muted/20 mb-3"
            />
            <div className="flex justify-between items-center mb-10">
              <span className={`text-[11px] uppercase tracking-[0.3em] font-medium ${draftThought.length > 160 ? 'text-visto-wine' : 'text-visto-muted/40'}`}>
                {draftThought.length} / 180
              </span>
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-4 bg-visto-wine text-white rounded-full font-medium text-sm tracking-wide visto-btn-shadow active:scale-[0.98] transition-all duration-200 mb-4"
            >
              continuar →
            </button>
            <button
              onClick={() => setStep(1)}
              className="w-full py-3 text-visto-muted text-sm hover:text-visto-wine transition-colors duration-200"
            >
              ainda não sei o que escrever
            </button>
          </motion.div>
        )}

        {/* ── Step 1: Contato — o pacto de confiança ── */}
        {step === 1 && (
          <motion.div key="step1" {...fadeUp}>
            <p className="text-[11px] uppercase tracking-[0.4em] text-visto-muted font-medium mb-12">
              passo 2 de 3
            </p>
            <h2 className="text-4xl font-serif text-visto-wine tracking-tighter mb-3 leading-tight">
              Como alguém pode te encontrar?
            </h2>
            <p className="text-visto-muted text-sm mb-10 leading-relaxed">
              Se alguém se identificar com o que você escrever, vai usar esse contato para falar com você. Só você vai receber essa mensagem — nunca aparece no feed.
            </p>

            <div className="flex gap-3 mb-8">
              {(['whatsapp', 'telegram', 'email'] as ContactType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setContactType(type)}
                  className={`flex-1 py-3 rounded-full text-[11px] font-medium tracking-widest transition-all duration-300 ${
                    contactType === type
                      ? 'bg-visto-wine text-white'
                      : 'bg-visto-bg-warm text-visto-muted hover:text-visto-wine border border-visto-wine/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-10">
              <label className="block text-[10px] uppercase tracking-[0.3em] text-visto-muted font-medium">
                {contactLabel[contactType]}
              </label>
              <input
                type={contactType === 'email' ? 'email' : 'text'}
                value={contactValue}
                onChange={e => setContactValue(e.target.value)}
                placeholder={contactPlaceholder[contactType]}
                className="w-full border-b border-visto-wine/20 py-4 focus:border-visto-wine outline-none bg-transparent transition-all duration-300 placeholder:text-visto-muted/20 text-lg"
                autoFocus
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!contactValue.trim()}
              className="w-full py-4 bg-visto-wine text-white rounded-full font-medium text-sm tracking-wide visto-btn-shadow active:scale-[0.98] transition-all duration-200 disabled:opacity-30 mb-4"
            >
              continuar →
            </button>
            <button
              onClick={() => setStep(0)}
              className="w-full py-3 text-visto-muted text-sm hover:text-visto-wine transition-colors duration-200"
            >
              ← voltar
            </button>
          </motion.div>
        )}

        {/* ── Step 2: Nome — o menos que precisamos saber ── */}
        {step === 2 && (
          <motion.div key="step2" {...fadeUp}>
            <p className="text-[11px] uppercase tracking-[0.4em] text-visto-muted font-medium mb-12">
              {initialProfile ? 'editar perfil' : 'passo 3 de 3'}
            </p>
            <h2 className="text-4xl font-serif text-visto-wine tracking-tighter mb-3 leading-tight">
              Como você quer ser visto?
            </h2>
            <p className="text-visto-muted text-sm mb-10 leading-relaxed">
              Sem username. Sem @. Só seu nome — como você prefere que as pessoas te chamem.
            </p>

            <div className="space-y-8 mb-12">
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.3em] text-visto-muted font-medium">seu nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ex: Paulo, P. Nascimento..."
                  className="w-full border-b border-visto-wine/20 py-4 focus:border-visto-wine outline-none bg-transparent transition-all duration-300 placeholder:text-visto-muted/20 text-lg"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.3em] text-visto-muted font-medium">
                  sua cidade <span className="normal-case tracking-normal font-light">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="ex: Porto Alegre"
                  className="w-full border-b border-visto-wine/20 py-4 focus:border-visto-wine outline-none bg-transparent transition-all duration-300 placeholder:text-visto-muted/20 text-lg"
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={!name.trim() || !contactValue.trim() || saving}
              className="w-full py-4 bg-visto-wine text-white rounded-full font-medium text-sm tracking-wide visto-btn-shadow active:scale-[0.98] transition-all duration-200 disabled:opacity-30 mb-4"
            >
              {saving ? 'entrando...' : initialProfile ? 'salvar alterações' : 'entrar no visto →'}
            </button>
            {!initialProfile && (
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 text-visto-muted text-sm hover:text-visto-wine transition-colors duration-200"
              >
                ← voltar
              </button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ThoughtCard
// ---------------------------------------------------------------------------
const ThoughtCard = ({
  thought,
  isOwner,
  onDelete,
  isSeed = false,
}: {
  thought: Thought | (typeof SEED_THOUGHTS)[0];
  isOwner?: boolean;
  onDelete?: (id: string) => void | Promise<void>;
  isSeed?: boolean;
}) => {
  const getContactLink = () => {
    if (isSeed || !('contactValue' in thought)) return '#';
    const t = thought as Thought;

    const firstName = t.authorName.split(' ')[0];
    const msg = `👁 te vi no visto.\n\n"${t.text}"\n\nvi isso no visto e quis falar com você.\n\n— visto-kappa.vercel.app`;

    let val = t.contactValue.replace(/\D/g, '');
    if (t.contactType === 'whatsapp' && (val.length === 10 || val.length === 11) && !val.startsWith('55')) val = '55' + val;
    if (t.contactType === 'whatsapp') return `https://wa.me/${val}?text=${encodeURIComponent(msg)}`;
    if (t.contactType === 'telegram') { const u = t.contactValue.replace('@', '').trim(); return `tg://resolve?domain=${u}&text=${encodeURIComponent(msg)}`; }
    return `mailto:${t.contactValue}?subject=${encodeURIComponent(`👁 te vi no visto`)}&body=${encodeURIComponent(msg)}`;
  };

  const contactIcon = !isSeed && 'contactType' in thought ? (
    thought.contactType === 'whatsapp' ? <MessageCircle size={14} strokeWidth={1.5} /> :
    thought.contactType === 'telegram' ? <Send size={14} strokeWidth={1.5} /> :
    <Mail size={14} strokeWidth={1.5} />
  ) : null;

  const timeAgo = !isSeed && 'createdAt' in thought && thought.createdAt?.toDate
    ? formatDistanceToNow(thought.createdAt.toDate(), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`p-8 rounded-2xl border mb-8 transition-all duration-500 ${
        isSeed
          ? 'bg-visto-bg-warm/50 border-visto-wine/5 opacity-60'
          : 'bg-visto-bg-warm border-visto-wine/10 hover:border-visto-wine/25'
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          {'authorPhotoURL' in thought && thought.authorPhotoURL ? (
            <div className="w-10 h-10 rounded-full overflow-hidden border border-visto-wine/10 shrink-0">
              <img src={thought.authorPhotoURL} alt={thought.authorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : null}
          <div className="flex flex-col">
            <span className="font-serif text-2xl text-visto-wine tracking-tighter leading-none">{thought.authorName}</span>
            {thought.authorCity && (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-visto-muted mt-2 font-medium">
                <MapPin size={10} strokeWidth={2} />
                {thought.authorCity}
              </span>
            )}
          </div>
        </div>
        {timeAgo && (
          <span className="text-[10px] text-visto-muted/30 uppercase tracking-[0.15em] font-medium shrink-0">
            {timeAgo}
          </span>
        )}
      </div>

      {/* Pensamento */}
      <p className="text-visto-text leading-relaxed mb-10 text-xl font-serif font-light opacity-90 tracking-tight">
        "{thought.text}"
      </p>

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-6 border-t border-visto-wine/8">
        {!isSeed && 'contactType' in thought ? (
          <a
            href={getContactLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] font-medium text-visto-wine hover:opacity-50 transition-all duration-200"
          >
            {contactIcon}
            falar com {thought.authorName.split(' ')[0]}
          </a>
        ) : (
          <span className="text-[10px] text-visto-muted/30 uppercase tracking-[0.25em] italic">pensamento semente</span>
        )}

        {isOwner && onDelete && 'id' in thought && (
          <button
            onClick={() => onDelete((thought as Thought).id)}
            className="text-visto-wine opacity-20 hover:opacity-70 transition-all duration-300"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------
const Feed = ({ userProfile }: { userProfile: UserProfile }) => {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [text, setText] = useState('');
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [userTodayCount, setUserTodayCount] = useState(0);
  const [justPosted, setJustPosted] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'thoughts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snapshot => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Thought));
      setThoughts(docs);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      setUserTodayCount(docs.filter(t => t.uid === userProfile.uid && t.createdAt?.toDate?.() > today).length);
      setLoadingFeed(false);
    });
    return unsub;
  }, [userProfile.uid]);

  const handlePost = async () => {
    if (!text.trim() || text.length > 180 || userTodayCount >= 3) return;
    try {
      await addDoc(collection(db, 'thoughts'), {
        uid: userProfile.uid,
        authorName: userProfile.name,
        authorCity: userProfile.city || '',
        authorPhotoURL: userProfile.photoURL || '',
        text: text.trim(),
        contactType: userProfile.contactType,
        contactValue: userProfile.contactValue,
        createdAt: serverTimestamp(),
      });
      setText('');
      setShowCreate(false);
      setJustPosted(true);
      setTimeout(() => setJustPosted(false), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  // Feed nunca aparece vazio — usa pensamentos semente enquanto não há conteúdo real
  const displayThoughts = thoughts.length > 0 ? thoughts : [];
  const showSeeds = thoughts.length === 0 && !loadingFeed;

  if (loadingFeed) return <Loading />;

  return (
    <div className="max-w-xl mx-auto px-8 pb-32">
      {/* Header */}
      <header className="flex justify-between items-center py-16 mb-8">
        <h1 className="text-6xl font-serif text-visto-wine tracking-tighter">visto</h1>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('show-profile'))}
          className="text-visto-wine opacity-40 hover:opacity-100 transition-all duration-500"
        >
          {userProfile.photoURL ? (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-visto-wine/10">
              <img src={userProfile.photoURL} alt={userProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <UserIcon size={24} strokeWidth={1} />
          )}
        </button>
      </header>

      {/* Toast pós-postagem */}
      <AnimatePresence>
        {justPosted && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="mb-8 px-6 py-4 bg-visto-bg-warm border border-visto-wine/15 rounded-2xl"
          >
            <p className="text-sm text-visto-wine font-serif font-light tracking-tight">
              seu pensamento foi publicado. se alguém se identificar, você vai saber.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saudação */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="text-visto-wine font-serif text-xl font-light opacity-50 tracking-tight mb-16"
      >
        o que as pessoas estão pensando agora.
      </motion.p>

      {/* Pensamentos semente — visíveis apenas com feed vazio */}
      {showSeeds && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }}>
          <p className="text-[10px] uppercase tracking-[0.4em] text-visto-muted/40 font-medium mb-8 text-center">
            primeiros pensamentos do visto
          </p>
          {SEED_THOUGHTS.map((t, i) => (
            <ThoughtCard key={i} thought={t as any} isSeed />
          ))}
        </motion.div>
      )}

      {/* Feed real */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="space-y-0"
      >
        {displayThoughts.map(t => (
          <ThoughtCard
            key={t.id}
            thought={t}
            isOwner={t.uid === userProfile.uid}
            onDelete={async id => { try { await deleteDoc(doc(db, 'thoughts', id)); } catch (e) { console.error(e); } }}
          />
        ))}
      </motion.div>

      {/* Tela de composição */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-visto-bg z-50 p-6 md:p-12 flex flex-col overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-12 shrink-0">
              <button onClick={() => setShowCreate(false)} className="text-visto-wine hover:opacity-50 transition-opacity">
                <ChevronLeft size={36} strokeWidth={1} />
              </button>
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-[0.5em] text-visto-muted font-medium">novo pensamento</span>
                <p className="text-[10px] text-visto-muted/40 mt-1">{Math.max(0, 3 - userTodayCount)} restantes hoje</p>
              </div>
              <div className="w-9" />
            </div>

            <div className="flex-1 flex flex-col max-w-lg mx-auto w-full pb-12">
              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="o que está na sua cabeça agora?"
                className="w-full bg-transparent text-3xl md:text-4xl font-serif text-visto-text placeholder:text-visto-muted/10 outline-none resize-none min-h-[200px] leading-tight font-light tracking-tight"
                maxLength={180}
              />
              <div className="flex justify-between items-center mt-8 border-t border-visto-wine/10 pt-8 shrink-0">
                <span className={`text-[11px] uppercase tracking-[0.3em] font-medium ${text.length > 160 ? 'text-visto-wine' : 'text-visto-muted/40'}`}>
                  {text.length} / 180
                </span>
              </div>
              <button
                onClick={handlePost}
                disabled={!text.trim() || userTodayCount >= 3}
                className="w-full py-5 bg-visto-wine text-white rounded-full font-medium text-sm tracking-wide mt-12 visto-btn-shadow active:scale-[0.98] transition-all duration-300 disabled:opacity-20"
              >
                publicar
              </button>
              {userTodayCount >= 3 && (
                <p className="text-center text-[10px] uppercase tracking-[0.3em] text-visto-wine mt-6 font-medium opacity-40">
                  você já publicou seus 3 pensamentos hoje.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      {!showCreate && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.06, translateY: -2 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowCreate(true)}
          className="fixed bottom-10 right-10 w-14 h-14 bg-visto-wine text-white rounded-full shadow-lg flex items-center justify-center z-40"
        >
          <Plus size={28} strokeWidth={1.5} />
        </motion.button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
const Profile = ({
  userProfile,
  onSignOut,
  onEdit,
}: {
  userProfile: UserProfile;
  onSignOut: () => void;
  onEdit: () => void;
}) => {
  const [myThoughts, setMyThoughts] = useState<Thought[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'thoughts'), where('uid', '==', userProfile.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMyThoughts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Thought)));
    });
    return unsub;
  }, [userProfile.uid]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 250 }}
      className="fixed inset-0 bg-visto-bg z-50 overflow-y-auto"
    >
      <div className="max-w-xl mx-auto p-10">
        <header className="flex justify-between items-center py-16 mb-16">
          <button onClick={() => window.dispatchEvent(new CustomEvent('hide-profile'))} className="text-visto-wine hover:opacity-40 transition-opacity">
            <ChevronLeft size={36} strokeWidth={1} />
          </button>
          <h2 className="text-3xl font-serif text-visto-wine tracking-tighter">seu perfil</h2>
          <div className="w-9" />
        </header>

        <div className="text-center mb-20">
          <div className="w-24 h-24 bg-visto-bg-warm rounded-full flex items-center justify-center mx-auto mb-8 border border-visto-wine/10 overflow-hidden">
            {userProfile.photoURL ? (
              <img src={userProfile.photoURL} alt={userProfile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={40} strokeWidth={0.5} className="text-visto-wine opacity-20" />
            )}
          </div>
          <h3 className="text-5xl font-serif text-visto-wine tracking-tighter mb-4">{userProfile.name}</h3>
          <div className="flex flex-col items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-visto-muted font-medium">
            {userProfile.city && (
              <span className="flex items-center gap-1.5 opacity-40">
                <MapPin size={12} strokeWidth={2} />{userProfile.city}
              </span>
            )}
            <span className="opacity-30">{userProfile.contactType}: {userProfile.contactValue}</span>
          </div>
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={onEdit} className="px-6 py-2.5 border border-visto-wine/20 text-visto-wine text-[10px] uppercase tracking-[0.3em] font-medium rounded-full hover:bg-visto-wine hover:text-white transition-all duration-300">
              editar
            </button>
            <button onClick={onSignOut} className="px-6 py-2.5 border border-visto-wine/20 text-visto-wine text-[10px] uppercase tracking-[0.3em] font-medium rounded-full hover:bg-visto-wine hover:text-white transition-all duration-300">
              sair
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.5em] text-visto-muted font-medium mb-10 border-b border-visto-wine/10 pb-6">
            seus pensamentos
          </p>
          {myThoughts.length === 0 ? (
            <p className="text-center py-24 text-visto-muted font-serif text-xl opacity-20 tracking-tight">
              nenhum pensamento ainda.
            </p>
          ) : (
            myThoughts.map(t => (
              <ThoughtCard
                key={t.id}
                thought={t}
                isOwner
                onDelete={async id => { try { await deleteDoc(doc(db, 'thoughts', id)); } catch (e) { console.error(e); } }}
              />
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// App Root
// ---------------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      try {
        setUser(u);
        if (u) {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) setUserProfile(snap.data() as UserProfile);
        } else {
          setUserProfile(null);
        }
      } catch (err) {
        console.error(err);
        setError(err);
      } finally {
        setLoading(false);
      }
    });

    const show = () => setShowProfile(true);
    const hide = () => setShowProfile(false);
    window.addEventListener('show-profile', show);
    window.addEventListener('hide-profile', hide);
    return () => { unsub(); window.removeEventListener('show-profile', show); window.removeEventListener('hide-profile', hide); };
  }, []);

  const handleSignOut = () => { auth.signOut(); setShowProfile(false); };

  if (loading) return <Loading />;

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-visto-bg">
      <h2 className="text-2xl font-serif text-visto-wine mb-4">algo não saiu como esperado.</h2>
      <p className="text-visto-muted text-sm mb-6 max-w-sm leading-relaxed">
        ocorreu um erro ao carregar o visto. tente recarregar a página.
      </p>
      <button onClick={() => window.location.reload()} className="px-6 py-2.5 border border-visto-wine text-visto-wine text-sm rounded-full hover:bg-visto-wine hover:text-white transition-all duration-300">
        recarregar
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-visto-bg selection:bg-visto-wine/10">
      {!user ? (
        <Login />
      ) : (!userProfile || isEditingProfile) ? (
        <Onboarding
          user={user}
          initialProfile={userProfile}
          onComplete={profile => { setUserProfile(profile); setIsEditingProfile(false); }}
        />
      ) : (
        <>
          <Feed userProfile={userProfile} />
          <AnimatePresence>
            {showProfile && (
              <Profile
                userProfile={userProfile}
                onSignOut={handleSignOut}
                onEdit={() => { setIsEditingProfile(true); setShowProfile(false); }}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
