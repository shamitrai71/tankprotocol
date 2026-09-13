import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, onSnapshot
} from 'firebase/firestore';
import { db } from './lib/firebase';
import {
  Globe, MapPin, Hotel, Utensils, Compass, Activity, Plus, Trash2,
  Save, X, ChevronRight, ChevronDown, LogOut, Eye, EyeOff,
  Edit3, AlertCircle, CheckCircle2, Loader2, Building, Search
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaceItem {
  id?: string;
  name: string;
  place_id: string;
  category: 'hotel' | 'restaurant' | 'attraction' | 'activity';
  rating?: number;
  vicinity?: string;
  notes?: string;
}

interface Destination {
  id?: string;
  name: string;
  country: string;
  placeId: string;
  image: string;
  tag: string;
  price: string;
  rating: number;
  budget: 'economy' | 'premium' | 'luxury';
  activities: string[];
  coords: [number, number];
  items?: PlaceItem[];
}

interface Country {
  id?: string;
  name: string;
  code: string;
  image: string;
  destinations?: Destination[];
}

// ── Admin Password Gate ───────────────────────────────────────────────────────

const ADMIN_PASSWORD = 'tankbazaar2024';

const PasswordGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-ink flex items-center justify-center z-[999]">
      <motion.div
        animate={shaking ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-coral/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 text-brand-coral" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Admin Access</h1>
          <p className="text-gray-400 text-sm mt-1 font-bold tracking-widest uppercase text-[10px]">Abledinos Control Panel</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="Enter admin password"
              className={`w-full bg-white/10 border-2 rounded-2xl px-5 py-4 text-white placeholder-gray-500 font-bold outline-none transition-all ${
                error ? 'border-brand-coral' : 'border-white/10 focus:border-brand-teal'
              }`}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-brand-coral text-xs font-black text-center uppercase tracking-widest flex items-center justify-center gap-1">
              <AlertCircle className="w-3 h-3" /> Incorrect password
            </motion.p>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-brand-coral text-white font-black uppercase tracking-widest py-4 rounded-2xl text-sm"
          >
            Unlock Panel
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────────────────────────

const Toast = ({ message, type }: { message: string; type: 'success' | 'error' }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className={`fixed bottom-8 right-8 z-[9999] px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 shadow-2xl ${
      type === 'success' ? 'bg-brand-teal text-white' : 'bg-brand-coral text-white'
    }`}
  >
    {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
    {message}
  </motion.div>
);

// ── Modal ─────────────────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-brand-ink/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      onClick={e => e.stopPropagation()}
      className="bg-brand-bg rounded-[2rem] p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-brand-ink uppercase tracking-tighter">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

// ── Field ─────────────────────────────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
    {children}
  </div>
);

const Input = ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-ink outline-none focus:border-brand-teal transition-colors bg-white"
  />
);

const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-ink outline-none focus:border-brand-teal transition-colors bg-white"
  >
    {children}
  </select>
);

// ── Place Item Form ───────────────────────────────────────────────────────────

const PlaceItemForm = ({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<PlaceItem>;
  onSave: (item: PlaceItem) => void;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState<PlaceItem>({
    name: initial?.name || '',
    place_id: initial?.place_id || '',
    category: initial?.category || 'hotel',
    rating: initial?.rating || undefined,
    vicinity: initial?.vicinity || '',
    notes: initial?.notes || '',
  });

  const set = (k: keyof PlaceItem, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Place Name">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mandarin Oriental" />
        </Field>
        <Field label="Google Place ID">
          <Input value={form.place_id} onChange={e => set('place_id', e.target.value)} placeholder="ChIJ..." />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={e => set('category', e.target.value as any)}>
            <option value="hotel">Hotel</option>
            <option value="restaurant">Restaurant</option>
            <option value="attraction">Attraction</option>
            <option value="activity">Activity</option>
          </Select>
        </Field>
        <Field label="Rating (optional)">
          <Input type="number" step="0.1" min="0" max="5" value={form.rating || ''} onChange={e => set('rating', parseFloat(e.target.value))} placeholder="4.5" />
        </Field>
        <Field label="Vicinity / Address">
          <Input value={form.vicinity} onChange={e => set('vicinity', e.target.value)} placeholder="123 Main St, City" />
        </Field>
        <Field label="Notes (optional)">
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Best rooftop bar..." />
        </Field>
      </div>
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onSave(form)}
          disabled={!form.name || !form.place_id}
          className="flex-1 bg-brand-teal text-white font-black uppercase tracking-widest py-3 rounded-xl text-xs disabled:opacity-40"
        >
          Save Item
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onCancel} className="px-4 py-3 bg-gray-200 rounded-xl font-black text-xs uppercase tracking-widest">
          Cancel
        </motion.button>
      </div>
    </div>
  );
};

// ── Destination Form ──────────────────────────────────────────────────────────

const DestinationForm = ({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Destination>;
  onSave: (d: Destination) => void;
  onCancel: () => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<Destination>({
    name: initial?.name || '',
    country: initial?.country || '',
    placeId: initial?.placeId || '',
    image: initial?.image || '',
    tag: initial?.tag || 'Culture',
    price: initial?.price || 'From $0',
    rating: initial?.rating || 4.5,
    budget: initial?.budget || 'economy',
    activities: initial?.activities || [],
    coords: initial?.coords || [0, 0],
    items: initial?.items || [],
  });
  const [addingItem, setAddingItem] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);

  const set = (k: keyof Destination, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleAddItem = (item: PlaceItem) => {
    set('items', [...(form.items || []), item]);
    setAddingItem(false);
  };

  const handleEditItem = (idx: number, item: PlaceItem) => {
    const updated = [...(form.items || [])];
    updated[idx] = item;
    set('items', updated);
    setEditingItemIdx(null);
  };

  const handleDeleteItem = (idx: number) => {
    set('items', (form.items || []).filter((_, i) => i !== idx));
  };

  const categoryIcon = (cat: string) => {
    if (cat === 'hotel') return <Hotel className="w-3 h-3" />;
    if (cat === 'restaurant') return <Utensils className="w-3 h-3" />;
    if (cat === 'attraction') return <Compass className="w-3 h-3" />;
    return <Activity className="w-3 h-3" />;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Destination Name">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Bangkok, Thailand" />
        </Field>
        <Field label="Country">
          <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. Thailand" />
        </Field>
        <Field label="Google Place ID">
          <Input value={form.placeId} onChange={e => set('placeId', e.target.value)} placeholder="ChIJ..." />
        </Field>
        <Field label="Tag">
          <Select value={form.tag} onChange={e => set('tag', e.target.value)}>
            {['Romance', 'Culture', 'Adventure', 'Elegance', 'Nature', 'Food'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Image URL">
          <Input value={form.image} onChange={e => set('image', e.target.value)} placeholder="https://images.unsplash.com/..." />
        </Field>
        <Field label="Price (e.g. From $800)">
          <Input value={form.price} onChange={e => set('price', e.target.value)} placeholder="From $800" />
        </Field>
        <Field label="Rating (0–5)">
          <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={e => set('rating', parseFloat(e.target.value))} />
        </Field>
        <Field label="Budget">
          <Select value={form.budget} onChange={e => set('budget', e.target.value as any)}>
            <option value="economy">Economy</option>
            <option value="premium">Premium</option>
            <option value="luxury">Luxury</option>
          </Select>
        </Field>
        <Field label="Latitude">
          <Input type="number" step="0.0001" value={form.coords[0]} onChange={e => set('coords', [parseFloat(e.target.value), form.coords[1]])} placeholder="13.7563" />
        </Field>
        <Field label="Longitude">
          <Input type="number" step="0.0001" value={form.coords[1]} onChange={e => set('coords', [form.coords[0], parseFloat(e.target.value)])} placeholder="100.5018" />
        </Field>
      </div>

      {/* Items Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hotels, Restaurants & Attractions</p>
          <button
            onClick={() => setAddingItem(true)}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-brand-teal hover:text-brand-coral transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Item
          </button>
        </div>

        {addingItem && (
          <PlaceItemForm onSave={handleAddItem} onCancel={() => setAddingItem(false)} />
        )}

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {(form.items || []).map((item, idx) => (
            <div key={idx}>
              {editingItemIdx === idx ? (
                <PlaceItemForm
                  initial={item}
                  onSave={updated => handleEditItem(idx, updated)}
                  onCancel={() => setEditingItemIdx(null)}
                />
              ) : (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-gray-100 group">
                  <div className={`p-1.5 rounded-lg text-white ${
                    item.category === 'hotel' ? 'bg-brand-teal' :
                    item.category === 'restaurant' ? 'bg-brand-coral' :
                    item.category === 'attraction' ? 'bg-brand-yellow text-brand-ink' : 'bg-brand-blue'
                  }`}>
                    {categoryIcon(item.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-brand-ink truncate">{item.name}</p>
                    <p className="text-[9px] text-gray-400 font-mono truncate">{item.place_id}</p>
                  </div>
                  {item.rating && <span className="text-[9px] font-black text-brand-yellow">★ {item.rating}</span>}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingItemIdx(idx)} className="p-1 hover:bg-gray-100 rounded-lg">
                      <Edit3 className="w-3 h-3 text-gray-400" />
                    </button>
                    <button onClick={() => handleDeleteItem(idx)} className="p-1 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3 h-3 text-brand-coral" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {(form.items || []).length === 0 && !addingItem && (
            <p className="text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest py-4">No items added yet</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onSave(form)}
          disabled={saving || !form.name || !form.country}
          className="flex-1 bg-brand-ink text-white font-black uppercase tracking-widest py-4 rounded-2xl text-xs flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Destination'}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onCancel} className="px-6 py-4 bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest">
          Cancel
        </motion.button>
      </div>
    </div>
  );
};

// ── Country Form ──────────────────────────────────────────────────────────────

const CountryForm = ({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Country>;
  onSave: (c: Country) => void;
  onCancel: () => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<Country>({
    name: initial?.name || '',
    code: initial?.code || '',
    image: initial?.image || '',
  });
  const set = (k: keyof Country, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Country Name">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Thailand" />
        </Field>
        <Field label="Country Code">
          <Input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. TH" maxLength={3} />
        </Field>
      </div>
      <Field label="Cover Image URL">
        <Input value={form.image} onChange={e => set('image', e.target.value)} placeholder="https://images.unsplash.com/..." />
      </Field>
      {form.image && (
        <img src={form.image} alt="preview" className="w-full h-32 object-cover rounded-xl" />
      )}
      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onSave(form)}
          disabled={saving || !form.name || !form.code}
          className="flex-1 bg-brand-ink text-white font-black uppercase tracking-widest py-4 rounded-2xl text-xs flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Country'}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onCancel} className="px-6 py-4 bg-gray-100 rounded-2xl font-black text-xs uppercase tracking-widest">
          Cancel
        </motion.button>
      </div>
    </div>
  );
};

// ── Main Admin Panel ──────────────────────────────────────────────────────────

const AdminPanelContent = ({ onLogout }: { onLogout: () => void }) => {
  const [tab, setTab] = useState<'countries' | 'destinations'>('destinations');
  const [countries, setCountries] = useState<Country[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');

  // Modals
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [addingCountry, setAddingCountry] = useState(false);
  const [editingDest, setEditingDest] = useState<Destination | null>(null);
  const [addingDest, setAddingDest] = useState(false);
  const [expandedDest, setExpandedDest] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load from Firestore
  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'admin_countries'), snap => {
      setCountries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Country)));
    });
    const unsub2 = onSnapshot(collection(db, 'admin_destinations'), snap => {
      setDestinations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Destination)));
      setLoading(false);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Country CRUD
  const saveCountry = async (c: Country) => {
    setSaving(true);
    try {
      if (c.id) {
        const { id, ...data } = c;
        await updateDoc(doc(db, 'admin_countries', id), data);
      } else {
        await addDoc(collection(db, 'admin_countries'), c);
      }
      showToast('Country saved successfully');
      setEditingCountry(null);
      setAddingCountry(false);
    } catch (e) {
      showToast('Failed to save country', 'error');
    }
    setSaving(false);
  };

  const deleteCountry = async (id: string) => {
    if (!confirm('Delete this country?')) return;
    try {
      await deleteDoc(doc(db, 'admin_countries', id));
      showToast('Country deleted');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  // Destination CRUD
  const saveDest = async (d: Destination) => {
    setSaving(true);
    try {
      if (d.id) {
        const { id, ...data } = d;
        await updateDoc(doc(db, 'admin_destinations', id), data);
      } else {
        await addDoc(collection(db, 'admin_destinations'), d);
      }
      showToast('Destination saved successfully');
      setEditingDest(null);
      setAddingDest(false);
    } catch (e) {
      showToast('Failed to save destination', 'error');
    }
    setSaving(false);
  };

  const deleteDest = async (id: string) => {
    if (!confirm('Delete this destination?')) return;
    try {
      await deleteDoc(doc(db, 'admin_destinations', id));
      showToast('Destination deleted');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const filtered = destinations.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.country.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-brand-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <div className="bg-brand-ink text-white px-8 py-5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-coral/20 rounded-2xl flex items-center justify-center">
            <Building className="w-5 h-5 text-brand-coral" />
          </div>
          <div>
            <h1 className="font-black text-lg uppercase tracking-tighter leading-none">Abledinos Admin</h1>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Content Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/10 rounded-xl p-1 gap-1">
            {(['destinations', 'countries'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t ? 'bg-brand-coral text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogout}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            title="Close Admin Panel"
          >
            <X className="w-5 h-5 text-gray-400" />
          </motion.button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Destinations Tab ── */}
        {tab === 'destinations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-brand-ink uppercase tracking-tighter">Destinations</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{destinations.length} destinations configured</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAddingDest(true)}
                className="flex items-center gap-2 bg-brand-ink text-white font-black uppercase tracking-widest px-5 py-3 rounded-2xl text-xs"
              >
                <Plus className="w-4 h-4" /> Add Destination
              </motion.button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search destinations..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-2xl text-sm font-bold outline-none focus:border-brand-teal transition-colors bg-white"
              />
            </div>

            {/* Destination List */}
            <div className="space-y-3">
              {filtered.map(dest => (
                <motion.div
                  key={dest.id}
                  layout
                  className="bg-white rounded-[2rem] border-2 border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 p-5">
                    <img
                      src={dest.image}
                      alt={dest.name}
                      className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                      onError={e => (e.currentTarget.src = 'https://via.placeholder.com/64')}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-brand-ink truncate">{dest.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                          dest.budget === 'luxury' ? 'bg-brand-yellow/20 text-brand-ink' :
                          dest.budget === 'premium' ? 'bg-brand-teal/20 text-brand-teal' :
                          'bg-brand-green/20 text-green-700'
                        }`}>{dest.budget}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                        <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{dest.country}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{dest.placeId || 'No Place ID'}</span>
                        <span className="flex items-center gap-1"><Building className="w-3 h-3" />{(dest.items || []).length} items</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setExpandedDest(expandedDest === dest.id ? null : dest.id!)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedDest === dest.id ? 'rotate-180' : ''}`} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setEditingDest(dest)}
                        className="p-2 hover:bg-brand-teal/10 rounded-xl transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-brand-teal" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => deleteDest(dest.id!)}
                        className="p-2 hover:bg-brand-coral/10 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-brand-coral" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Expanded Items */}
                  <AnimatePresence>
                    {expandedDest === dest.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t-2 border-gray-100 px-5 pb-5 pt-4"
                      >
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Configured Items ({(dest.items || []).length})</p>
                        {(dest.items || []).length === 0 ? (
                          <p className="text-xs text-gray-300 font-bold italic">No items — edit destination to add hotels, restaurants & attractions</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {(dest.items || []).map((item, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] flex-shrink-0 ${
                                  item.category === 'hotel' ? 'bg-brand-teal' :
                                  item.category === 'restaurant' ? 'bg-brand-coral' :
                                  item.category === 'attraction' ? 'bg-brand-yellow' : 'bg-brand-blue'
                                }`}>
                                  {item.category === 'hotel' ? <Hotel className="w-3 h-3" /> :
                                   item.category === 'restaurant' ? <Utensils className="w-3 h-3" /> :
                                   item.category === 'attraction' ? <Compass className="w-3 h-3" /> :
                                   <Activity className="w-3 h-3" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black text-brand-ink truncate">{item.name}</p>
                                  <p className="text-[8px] text-gray-400 font-mono truncate">{item.place_id}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-16 text-gray-300">
                  <Compass className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-black uppercase tracking-widest text-sm">No destinations found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Countries Tab ── */}
        {tab === 'countries' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-brand-ink uppercase tracking-tighter">Countries</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{countries.length} countries configured</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAddingCountry(true)}
                className="flex items-center gap-2 bg-brand-ink text-white font-black uppercase tracking-widest px-5 py-3 rounded-2xl text-xs"
              >
                <Plus className="w-4 h-4" /> Add Country
              </motion.button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {countries.map(country => (
                <motion.div
                  key={country.id}
                  layout
                  className="bg-white rounded-[2rem] border-2 border-gray-100 overflow-hidden shadow-sm group"
                >
                  <div className="relative h-32">
                    <img
                      src={country.image}
                      alt={country.name}
                      className="w-full h-full object-cover"
                      onError={e => (e.currentTarget.src = 'https://via.placeholder.com/300x128')}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/60 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <p className="font-black text-white text-sm">{country.name}</p>
                        <p className="text-[9px] text-white/60 font-bold">{country.code}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingCountry(country)}
                          className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-brand-teal transition-colors"
                        >
                          <Edit3 className="w-3 h-3 text-white" />
                        </button>
                        <button
                          onClick={() => deleteCountry(country.id!)}
                          className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-brand-coral transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      {destinations.filter(d => d.country === country.name).length} destinations
                    </p>
                  </div>
                </motion.div>
              ))}

              {countries.length === 0 && (
                <div className="col-span-3 text-center py-16 text-gray-300">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-black uppercase tracking-widest text-sm">No countries yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {(addingDest || editingDest) && (
          <Modal
            title={editingDest ? 'Edit Destination' : 'Add Destination'}
            onClose={() => { setAddingDest(false); setEditingDest(null); }}
          >
            <DestinationForm
              initial={editingDest || undefined}
              onSave={saveDest}
              onCancel={() => { setAddingDest(false); setEditingDest(null); }}
              saving={saving}
            />
          </Modal>
        )}

        {(addingCountry || editingCountry) && (
          <Modal
            title={editingCountry ? 'Edit Country' : 'Add Country'}
            onClose={() => { setAddingCountry(false); setEditingCountry(null); }}
          >
            <CountryForm
              initial={editingCountry || undefined}
              onSave={saveCountry}
              onCancel={() => { setAddingCountry(false); setEditingCountry(null); }}
              saving={saving}
            />
          </Modal>
        )}

        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </div>
  );
};

// ── Export ────────────────────────────────────────────────────────────────────

export const AdminPanel = ({ onClose }: { onClose: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-brand-bg overflow-y-auto"
    >
      <AdminPanelContent onLogout={onClose} />
    </motion.div>
  );
};

export default AdminPanel;
