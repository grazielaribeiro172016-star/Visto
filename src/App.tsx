import React, { useState, useEffect, Component } from 'react';
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
  LogOut, 
  Plus, 
  Trash2, 
  MapPin,
  Mail,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Components ---

const Loading = () => (
  <div className="flex items-center justify-center min-h-screen bg-visto-bg">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ repeat: Infinity, duration: 2 }}
      className="text-5xl font-serif text-visto-wine tracking-tighter"
    >
      Visto
    </motion.div>
  </div>
);

const Login = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Ignore cancelled popup request errors as they are usually harmless
      if (error.code !== 'auth/cancelled-popup-request') {
        console.error("Login error:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        duration: 0.9,
        ease: "easeOut"
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center max-w-sm w-full"
      >
        <motion.h1 
          variants={itemVariants}
          className="text-9xl font-serif text-visto-wine mb-6 tracking-tighter"
        >
          Visto
        </motion.h1>
        
        <motion.p 
          variants={itemVariants}
          className="text-xs text-visto-muted mb-20 font-medium tracking-[0.3em] uppercase"
        >
          Presença real.
        </motion.p>
        
        <motion.button 
          variants={itemVariants}
          onClick={handleLogin}
          disabled={loading}
          className={`w-full px-10 py-4 bg-visto-wine text-white rounded-[50px] font-medium transition-all duration-200 visto-btn-shadow active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Conectando...' : 'Entrar com Google'}
        </motion.button>
      </motion.div>
    </div>
  );
};

const Onboarding = ({ user, onComplete, initialProfile }: { user: User, onComplete: (profile: UserProfile) => void, initialProfile?: UserProfile | null }) => {
  const [name, setName] = useState(initialProfile?.name || user.displayName || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [contactType, setContactType] = useState<ContactType>(initialProfile?.contactType || 'whatsapp');
  const [contactValue, setContactValue] = useState(initialProfile?.contactValue || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contactValue) return;

    const profile: UserProfile = {
      uid: user.uid,
      name,
      city,
      photoURL: user.photoURL || undefined,
      contactType,
      contactValue,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', user.uid), profile);
      onComplete(profile);
    } catch (error) {
      console.error("Onboarding error:", error);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center p-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <p className="text-visto-wine font-serif text-xl mb-16 opacity-80 tracking-tight">Aqui, você importa.</p>
        
        <h2 className="text-5xl font-serif text-visto-wine mb-4 tracking-tighter">Boas-vindas</h2>
        <p className="text-visto-muted mb-16 text-sm font-medium tracking-wide">Vamos preparar seu espaço no Visto.</p>
        
        <form onSubmit={handleSubmit} className="space-y-12">
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.3em] text-visto-muted font-bold">Como você quer ser chamado?</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full border-b border-visto-wine/20 py-4 focus:border-visto-wine outline-none bg-transparent transition-all duration-300 placeholder:text-visto-muted/20 text-lg"
              placeholder="Seu nome"
              required
            />
          </div>
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.3em] text-visto-muted font-bold">Onde você está? (opcional)</label>
            <input 
              type="text" 
              value={city} 
              onChange={(e) => setCity(e.target.value)}
              className="w-full border-b border-visto-wine/20 py-4 focus:border-visto-wine outline-none bg-transparent transition-all duration-300 placeholder:text-visto-muted/20 text-lg"
              placeholder="Sua cidade"
            />
          </div>
          <div className="space-y-6">
            <label className="block text-[10px] uppercase tracking-[0.3em] text-visto-muted font-bold">Contato preferido</label>
            <div className="flex gap-4">
              {(['whatsapp', 'telegram', 'email'] as ContactType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setContactType(type)}
                  className={`px-8 py-3 rounded-full text-[11px] font-bold tracking-widest transition-all duration-300 ${
                    contactType === type 
                      ? 'bg-visto-wine text-white shadow-lg' 
                      : 'bg-visto-bg-warm text-visto-muted hover:bg-visto-wine/5 hover:text-visto-wine'
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.3em] text-visto-muted font-bold">
              {contactType === 'email' ? 'Seu email' : 'Seu número (com +55 e DDD)'}
            </label>
            <input 
              type={contactType === 'email' ? 'email' : 'text'} 
              value={contactValue} 
              onChange={(e) => setContactValue(e.target.value)}
              className="w-full border-b border-visto-wine/20 py-4 focus:border-visto-wine outline-none bg-transparent transition-all duration-300 placeholder:text-visto-muted/20 text-lg"
              placeholder={contactType === 'email' ? 'exemplo@email.com' : '+55 11 99999-9999'}
              required
            />
            {contactType !== 'email' && (
              <p className="text-[9px] text-visto-muted/60 uppercase tracking-widest font-medium">
                Importante: inclua o +55 para que o link funcione corretamente.
              </p>
            )}
          </div>
          <button 
            type="submit"
            className="w-full py-5 bg-visto-wine text-white rounded-full font-bold uppercase tracking-[0.2em] text-xs mt-16 transition-all duration-300 visto-btn-shadow active:scale-[0.98]"
          >
            Começar
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const ThoughtCard = ({ thought, isOwner, onDelete }: { thought: Thought, isOwner?: boolean, onDelete?: (id: string) => void | Promise<void>, key?: any }) => {
  const getContactLink = () => {
    let val = thought.contactValue.replace(/\D/g, '');
    
    // Auto-fix for Brazilian numbers missing country code
    if (thought.contactType === 'whatsapp' && (val.length === 10 || val.length === 11) && !val.startsWith('55')) {
      val = '55' + val;
    }

    // Mensagem automática "Te vi no Visto"
    const msg = encodeURIComponent('👁️ Te vi no Visto!');
    
    if (thought.contactType === 'whatsapp') return `https://wa.me/${val}?text=${msg}`;
    if (thought.contactType === 'telegram') return `https://t.me/${thought.contactValue.replace('@', '')}?text=${msg}`;
    return `mailto:${thought.contactValue}?subject=${msg}`;
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="bg-visto-bg-warm p-8 rounded-2xl border border-visto-wine/10 mb-8 hover:border-visto-wine/20 transition-all duration-500"
    >
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          {thought.authorPhotoURL && (
            <div className="w-12 h-12 rounded-full overflow-hidden border border-visto-wine/10">
              <img 
                src={thought.authorPhotoURL} 
                alt={thought.authorName} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-serif text-3xl text-visto-wine tracking-tighter leading-none">{thought.authorName}</span>
            {thought.authorCity && (
              <span className="text-[10px] uppercase tracking-[0.3em] text-visto-muted mt-3 font-bold">{thought.authorCity}</span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-visto-muted uppercase tracking-[0.2em] font-bold opacity-30">
          {thought.createdAt?.toDate ? formatDistanceToNow(thought.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
        </span>
      </div>
      
      <p className="text-visto-text leading-relaxed mb-12 text-2xl font-light serif opacity-90 tracking-tight">
        "{thought.text}"
      </p>
      
      <div className="flex items-center justify-between pt-8 border-t border-visto-wine/10">
        <div className="flex gap-8">
          <a 
            href={getContactLink()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] font-bold text-visto-wine hover:opacity-50 transition-all"
          >
            {thought.contactType === 'whatsapp' && <MessageCircle size={16} strokeWidth={1} />}
            {thought.contactType === 'telegram' && <Send size={16} strokeWidth={1} />}
            {thought.contactType === 'email' && <Mail size={16} strokeWidth={1} />}
            Conectar
          </a>
        </div>
        
        {isOwner && onDelete && (
          <button 
            onClick={() => onDelete(thought.id)}
            className="text-visto-wine opacity-20 hover:opacity-100 transition-all duration-300"
          >
            <Trash2 size={16} strokeWidth={1} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

const Feed = ({ userProfile }: { userProfile: UserProfile }) => {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userTodayCount, setUserTodayCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'thoughts'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thought));
      setThoughts(docs);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = docs.filter(t => t.uid === userProfile.uid && t.createdAt?.toDate?.() > today).length;
      setUserTodayCount(count);
      
      setLoading(false);
    });
    return unsubscribe;
  }, [userProfile.uid]);

  const handlePost = async () => {
    if (!text.trim() || text.length > 180 || userTodayCount >= 3) return;

    const newThought = {
      uid: userProfile.uid,
      authorName: userProfile.name,
      authorCity: userProfile.city || '',
      authorPhotoURL: userProfile.photoURL || '',
      text: text.trim(),
      contactType: userProfile.contactType,
      contactValue: userProfile.contactValue,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'thoughts'), newThought);
      setText('');
      setShowCreate(false);
    } catch (error) {
      console.error("Post error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'thoughts', id));
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-xl mx-auto px-10 pb-32">
      <header className="flex justify-between items-center py-20 mb-12">
        <h1 className="text-7xl font-serif text-visto-wine tracking-tighter">Visto</h1>
        <div className="flex gap-10">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('show-profile'))} 
            className="text-visto-wine opacity-40 hover:opacity-100 transition-all duration-500"
          >
            {userProfile.photoURL ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-visto-wine/10">
                <img 
                  src={userProfile.photoURL} 
                  alt={userProfile.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <UserIcon size={28} strokeWidth={1} />
            )}
          </button>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="mb-24"
      >
        <p className="text-visto-wine font-serif text-2xl opacity-60 tracking-tight">Aqui, você importa.</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="space-y-4"
      >
        {thoughts.map(t => (
          <ThoughtCard 
            key={t.id} 
            thought={t} 
            isOwner={t.uid === userProfile.uid} 
            onDelete={handleDelete}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {showCreate && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 bg-visto-bg z-50 p-6 md:p-12 flex flex-col overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-12 md:mb-24 shrink-0">
              <button onClick={() => setShowCreate(false)} className="text-visto-wine hover:opacity-50 transition-opacity">
                <ChevronLeft size={40} strokeWidth={1} />
              </button>
              <span className="text-[10px] uppercase tracking-[0.5em] text-visto-muted font-bold">Novo Pensamento</span>
              <div className="w-10" />
            </div>

            <div className="flex-1 flex flex-col max-w-lg mx-auto w-full pb-12">
              <textarea 
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="qual pensamento voce quer compartilhar com o mundo hoje ?"
                className="w-full bg-transparent text-3xl md:text-5xl font-serif text-visto-text placeholder:text-visto-muted/10 outline-none resize-none min-h-[200px] md:h-80 leading-tight font-light tracking-tight"
                maxLength={180}
              />
              <div className="flex justify-between items-center mt-8 md:mt-16 border-t border-visto-wine/10 pt-10 shrink-0">
                <span className={`text-[11px] uppercase tracking-[0.3em] font-bold ${text.length > 170 ? 'text-visto-wine' : 'text-visto-muted'}`}>
                  {text.length} / 180
                </span>
                <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-visto-muted opacity-40">
                  {Math.max(0, 3 - userTodayCount)} restantes hoje
                </span>
              </div>
              
              <button 
                onClick={handlePost}
                disabled={!text.trim() || userTodayCount >= 3}
                className="w-full py-6 bg-visto-wine text-white rounded-full font-bold uppercase tracking-[0.2em] text-xs mt-12 md:mt-24 transition-all duration-300 visto-btn-shadow active:scale-[0.98] disabled:opacity-20 disabled:translate-y-0 shrink-0"
              >
                Publicar
              </button>
              {userTodayCount >= 3 && (
                <p className="text-center text-[10px] uppercase tracking-[0.3em] text-visto-wine mt-8 font-bold opacity-40">
                  Limite diário atingido.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showCreate && (
        <motion.button 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05, translateY: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreate(true)}
          className="fixed bottom-12 right-12 w-16 h-16 bg-visto-wine text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-shadow duration-300 hover:shadow-xl"
        >
          <Plus size={32} strokeWidth={1} />
        </motion.button>
      )}
    </div>
  );
};

const Profile = ({ userProfile, onSignOut, onEdit }: { userProfile: UserProfile, onSignOut: () => void, onEdit: () => void }) => {
  const [myThoughts, setMyThoughts] = useState<Thought[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'thoughts'), where('uid', '==', userProfile.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyThoughts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Thought)));
    });
    return unsubscribe;
  }, [userProfile.uid]);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 30, stiffness: 250 }}
      className="fixed inset-0 bg-visto-bg z-50 overflow-y-auto"
    >
      <div className="max-w-xl mx-auto p-12">
        <header className="flex justify-between items-center py-20 mb-20">
          <button onClick={() => window.dispatchEvent(new CustomEvent('hide-profile'))} className="text-visto-wine hover:opacity-40 transition-opacity">
            <ChevronLeft size={40} strokeWidth={1} />
          </button>
          <h2 className="text-4xl font-serif text-visto-wine tracking-tighter">Seu Perfil</h2>
          <div className="w-10" />
        </header>

        <div className="text-center mb-32">
          <div className="w-32 h-32 bg-visto-bg-warm rounded-full flex items-center justify-center mx-auto mb-10 border border-visto-wine/10 overflow-hidden">
            {userProfile.photoURL ? (
              <img 
                src={userProfile.photoURL} 
                alt={userProfile.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <UserIcon size={56} strokeWidth={0.5} className="text-visto-wine opacity-20" />
            )}
          </div>
          <h3 className="text-6xl font-serif text-visto-wine tracking-tighter mb-6">{userProfile.name}</h3>
          <div className="flex flex-col items-center gap-4 text-[11px] uppercase tracking-[0.4em] text-visto-muted font-bold">
            <div className="flex items-center gap-2 opacity-40">
              <MapPin size={14} strokeWidth={2} />
              {userProfile.city || 'Sem localização'}
            </div>
            <div className="flex items-center gap-2 mt-1 opacity-40">
              <ExternalLink size={14} strokeWidth={2} />
              {userProfile.contactType}: {userProfile.contactValue}
            </div>
          </div>
          
          <button 
            onClick={onEdit}
            className="mt-4 px-8 py-3 border border-visto-wine/20 text-visto-wine text-[10px] uppercase tracking-[0.3em] font-bold rounded-full hover:bg-visto-wine hover:text-white transition-all duration-300"
          >
            Editar Perfil
          </button>
          
          <button 
            onClick={onSignOut}
            className="mt-4 px-8 py-3 border border-visto-wine/20 text-visto-wine text-[10px] uppercase tracking-[0.3em] font-bold rounded-full hover:bg-visto-wine hover:text-white transition-all duration-300"
          >
            Desconectar
          </button>
        </div>

        <div className="space-y-12">
          <h4 className="text-[11px] uppercase tracking-[0.5em] text-visto-muted font-bold mb-16 border-b border-visto-wine/10 pb-8">Seus Pensamentos</h4>
          {myThoughts.length === 0 ? (
            <p className="text-center py-32 text-visto-muted font-serif text-2xl opacity-20 tracking-tight">Nenhum pensamento compartilhado ainda.</p>
          ) : (
            myThoughts.map(t => (
              <ThoughtCard 
                key={t.id} 
                thought={t} 
                isOwner 
                onDelete={async (id) => {
                  await deleteDoc(doc(db, 'thoughts', id));
                }} 
              />
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u) {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          }
        } else {
          setUserProfile(null);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    });

    const handleShowProfile = () => setShowProfile(true);
    const handleHideProfile = () => setShowProfile(false);

    window.addEventListener('show-profile', handleShowProfile);
    window.addEventListener('hide-profile', handleHideProfile);

    return () => {
      unsubscribe();
      window.removeEventListener('show-profile', handleShowProfile);
      window.removeEventListener('hide-profile', handleHideProfile);
    };
  }, []);

  const handleSignOut = () => {
    auth.signOut();
    setShowProfile(false);
  };

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-visto-bg">
        <h2 className="text-2xl font-serif text-visto-wine mb-4">Algo não saiu como esperado.</h2>
        <p className="text-visto-text opacity-70 mb-6 max-w-md">
          Ocorreu um erro ao carregar o VISTO. Por favor, tente recarregar a página.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 border border-visto-wine text-visto-wine rounded-full hover:bg-visto-wine hover:text-white transition-colors"
        >
          Recarregar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-visto-bg selection:bg-visto-wine/10">
      {!user ? (
        <Login />
      ) : (!userProfile || isEditingProfile) ? (
        <Onboarding 
          user={user} 
          initialProfile={userProfile}
          onComplete={(profile) => {
            setUserProfile(profile);
            setIsEditingProfile(false);
          }} 
        />
      ) : (
        <>
          <Feed userProfile={userProfile} />
          <AnimatePresence>
            {showProfile && (
              <Profile 
                userProfile={userProfile} 
                onSignOut={handleSignOut} 
                onEdit={() => {
                  setIsEditingProfile(true);
                  setShowProfile(false);
                }}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
