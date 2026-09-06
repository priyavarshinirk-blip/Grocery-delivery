import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Check, ChevronDown, CircleUserRound, Clock3, Leaf, LogIn, LogOut, Minus, Package, Plus, Search, ShoppingBag, ShieldCheck, Truck, X } from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const categories = [
  { label: 'All products', value: '' },
  { label: 'Fresh produce', value: 'Fruits & Vegetables' },
  { label: 'Dairy & eggs', value: 'Dairy' },
  { label: 'Pantry', value: 'Staples' },
  { label: 'Snacks', value: 'Snacks' },
  { label: 'Beverages', value: 'Beverages' },
];
const initialAddress = { line1: '', area: '', pincode: '' };

async function api(path, options = {}) {
  const token = localStorage.getItem('marketline_token');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Something went wrong');
  return body;
}

function readUser() {
  try { return JSON.parse(localStorage.getItem('marketline_user') || 'null'); } catch { return null; }
}

function App() {
  const [page, setPage] = useState(window.location.hash.replace('#', '') || 'shop');
  const [user, setUser] = useState(readUser);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('marketline_cart') || '[]'); } catch { return []; } });
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(!readUser());

  useEffect(() => {
    const navigate = () => setPage(window.location.hash.replace('#', '') || 'shop');
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => localStorage.setItem('marketline_cart', JSON.stringify(cart)), [cart]);

  const navigate = (next) => { window.location.hash = next; setCartOpen(false); };
  const addToCart = (product) => setCart((items) => {
    const existing = items.find((item) => item._id === product._id);
    return existing ? items.map((item) => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { ...product, quantity: 1 }];
  });
  const changeQuantity = (id, amount) => setCart((items) => items.map((item) => item._id === id ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  const logout = () => { localStorage.removeItem('marketline_token'); localStorage.removeItem('marketline_user'); setUser(null); setAuthOpen(true); };

  return <div className="app-shell">
    <Header user={user} onUserUpdate={setUser} cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} onCart={() => setCartOpen(true)} onAuth={() => setAuthOpen(true)} onLogout={logout} navigate={navigate} />
    <main>
      {page === 'shop' && <Shop user={user} onAdd={addToCart} navigate={navigate} onAuth={() => setAuthOpen(true)} />}
      {page === 'orders' && <Orders user={user} onAuth={() => setAuthOpen(true)} />}
      {page === 'privacy' && <LegalPage type="privacy" navigate={navigate} />}
      {page === 'terms' && <LegalPage type="terms" navigate={navigate} />}
    </main>
    <Footer navigate={navigate} />
    {cartOpen && <CartDrawer cart={cart} user={user} onClose={() => setCartOpen(false)} onChange={changeQuantity} onClear={() => setCart([])} onAuth={() => setAuthOpen(true)} />}
    {authOpen && !user && <AuthModal onSuccess={(nextUser) => { setUser(nextUser); setAuthOpen(false); }} onClose={() => setAuthOpen(false)} />}
  </div>;
}

function Header({ user, onUserUpdate, cartCount, onCart, onAuth, onLogout, navigate }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState({ line1: '', area: '', pincode: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const startEditing = () => { setName(user.name); setEmail(user.email); setPhone(user.phone || ''); setAddress({ line1: user.defaultAddress?.line1 || '', area: user.defaultAddress?.area || '', pincode: user.defaultAddress?.pincode || '' }); setError(''); setEditing(true); };
  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ name, email, phone, defaultAddress: address }) });
      localStorage.setItem('marketline_user', JSON.stringify(result.data.user));
      onUserUpdate(result.data.user);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return <header className="site-header"><div className="header-inner">
    <button className="brand" onClick={() => navigate('shop')} aria-label="Go to shop"><span className="brand-mark"><Leaf size={18} /></span><span>Marketline</span></button>
    <nav className="main-nav" aria-label="Main navigation"><button className={location.hash === '#orders' ? 'nav-link active' : 'nav-link'} onClick={() => user ? navigate('orders') : onAuth()}>Orders</button><button className={location.hash === '#privacy' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('privacy')}>About & policies</button></nav>
    <div className="header-actions"><button className="icon-button cart-button" onClick={onCart} aria-label="Open cart" title="Open cart"><ShoppingBag size={19} />{cartCount > 0 && <span className="cart-count">{cartCount}</span>}</button>{user ? <div className="account-wrap"><button className="account-button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen}><CircleUserRound size={17} />{user.name.split(' ')[0]}<ChevronDown size={15} /></button>{accountOpen && <div className="account-panel">{editing ? <form className="profile-form" onSubmit={saveProfile}><p className="eyebrow">Edit profile</p><label>Name<input required minLength="2" maxLength="100" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" /></label><label>Address<input value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} placeholder="Street and house number" /></label><label>Area<input value={address.area} onChange={(event) => setAddress({ ...address, area: event.target.value })} placeholder="Neighbourhood" /></label><label>Pincode<input value={address.pincode} onChange={(event) => setAddress({ ...address, pincode: event.target.value })} placeholder="Pincode" /></label>{error && <p className="form-message">{error}</p>}<div className="profile-actions"><button type="button" className="panel-cancel" onClick={() => setEditing(false)}>Cancel</button><button type="submit" className="panel-save" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div></form> : <><p className="eyebrow">Your account</p><strong>{user.name}</strong><span>{user.email}</span><span>{user.phone || 'No phone added'}</span><span className="account-role">{user.role.replaceAll('_', ' ')}</span><button className="panel-edit" onClick={startEditing}>Edit profile</button><button className="panel-orders" onClick={() => { setAccountOpen(false); navigate('orders'); }}>View orders <ArrowRight size={14} /></button><button className="panel-logout" onClick={onLogout}><LogOut size={14} />Sign out</button></>}</div>}</div> : <button className="text-button" onClick={onAuth}><LogIn size={16} />Sign in</button>}</div>
  </div></header>;
}

function Shop({ user, onAdd, navigate, onAuth }) {
  const [products, setProducts] = useState([]); const [category, setCategory] = useState(categories[0]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      setError('Sign in to browse the live catalog.');
      return;
    }
    setLoading(true);
    setError('');
    api(`/products?${query ? `search=${encodeURIComponent(query)}&` : ''}${category.value ? `category=${encodeURIComponent(category.value)}` : ''}`)
      .then((body) => setProducts(body.data.products))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, category, user]);
  return <>
    <section className="shop-intro"><div><p className="eyebrow">Local grocery delivery</p><h1>Good food, picked with care.</h1><p className="intro-copy">A clear, practical way to shop the everyday essentials from your neighbourhood store.</p><div className="intro-actions"><button className="primary-button" onClick={() => document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' })}>Browse the shop <ArrowRight size={16} /></button>{!user && <button className="quiet-button" onClick={onAuth}>Create an account</button>}</div></div><div className="intro-note"><div className="note-icon"><Truck size={21} /></div><div><strong>Delivery that fits your day</strong><span>Choose your address at checkout and we’ll confirm the nearest serviceable store.</span></div></div></section>
    <section className="catalog-section" id="catalog"><div className="section-heading"><div><p className="eyebrow">The shop</p><h2>What are you looking for?</h2></div><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products" /></label></div><div className="category-row">{categories.map((item) => <button key={item.label} className={category.value === item.value ? 'category active' : 'category'} onClick={() => setCategory(item)}>{item.label}</button>)}</div>{loading ? <div className="state-panel"><div className="loader" /><span>Loading the current catalog</span></div> : error ? <div className="state-panel error-state"><strong>Catalog unavailable</strong><span>{error}</span><button className="quiet-button" onClick={() => window.location.reload()}>Try again</button></div> : products.length === 0 ? <div className="state-panel"><Package size={22} /><span>No products match that search.</span></div> : <div className="product-grid">{products.map((product, index) => <ProductCard key={product._id} product={product} index={index} onAdd={onAdd} />)}</div>}</section>
  </>;
}

function ProductCard({ product, index, onAdd }) {
  return <article className={`product-card tone-${index % 5}`}><div className="product-visual"><span>{product.category?.slice(0, 1).toUpperCase() || 'M'}</span></div><div className="product-info"><p className="product-category">{product.category}</p><h3>{product.name}</h3><p className="product-description">{product.description || 'Everyday quality, ready for your kitchen.'}</p><div className="product-bottom"><div><strong>{money.format(product.price)}</strong><span> / {product.unit || 'unit'}</span></div><button className="add-button" onClick={() => onAdd(product)} aria-label={`Add ${product.name} to cart`} title={`Add ${product.name}`}><Plus size={18} /></button></div></div></article>;
}

function CartDrawer({ cart, user, onClose, onChange, onClear, onAuth }) {
  const [address, setAddress] = useState(initialAddress); const [slot, setSlot] = useState({ date: '', startTime: '', endTime: '' }); const [placing, setPlacing] = useState(false); const [message, setMessage] = useState(''); const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const placeOrder = async () => { if (!user) { onAuth(); return; } if (!address.line1 || !address.area || !address.pincode) { setMessage('Add your delivery address to continue.'); return; } if ((slot.date || slot.startTime || slot.endTime) && (!slot.date || !slot.startTime || !slot.endTime)) { setMessage('Complete all delivery slot fields or leave them blank.'); return; } setPlacing(true); setMessage(''); try { await api('/orders', { method: 'POST', body: JSON.stringify({ items: cart.map((item) => ({ productId: item._id, quantity: item.quantity })), deliveryAddress: address, deliverySlot: slot.date ? slot : undefined }) }); onClear(); onClose(); window.location.hash = 'orders'; } catch (err) { setMessage(err.message); } finally { setPlacing(false); } };
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-header"><div><p className="eyebrow">Your basket</p><h2>{cart.length ? `${cart.length} item${cart.length > 1 ? 's' : ''}` : 'Basket is empty'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close basket"><X size={20} /></button></div>{cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item._id}><div><strong>{item.name}</strong><span>{money.format(item.price)} / {item.unit}</span></div><div className="quantity"><button onClick={() => onChange(item._id, -1)} aria-label="Decrease quantity"><Minus size={14} /></button><span>{item.quantity}</span><button onClick={() => onChange(item._id, 1)} aria-label="Increase quantity"><Plus size={14} /></button></div></div>)}</div><div className="checkout-block"><div className="total-row"><span>Order total</span><strong>{money.format(total)}</strong></div><div className="address-fields"><label>Delivery address<input value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} placeholder="Street and house number" /></label><label>Area<input value={address.area} onChange={(event) => setAddress({ ...address, area: event.target.value })} placeholder="Neighbourhood" /></label><label>Pincode<input value={address.pincode} onChange={(event) => setAddress({ ...address, pincode: event.target.value })} placeholder="Pincode" /></label><label>Delivery date<input type="date" value={slot.date} onChange={(event) => setSlot({ ...slot, date: event.target.value })} /></label><div className="slot-fields"><label>From<input type="time" value={slot.startTime} onChange={(event) => setSlot({ ...slot, startTime: event.target.value })} /></label><label>To<input type="time" value={slot.endTime} onChange={(event) => setSlot({ ...slot, endTime: event.target.value })} /></label></div></div>{message && <p className="form-message">{message}</p>}<button className="primary-button full-button" disabled={placing} onClick={placeOrder}>{placing ? 'Placing order...' : user ? 'Place order' : 'Sign in to order'} <ArrowRight size={16} /></button><button className="clear-button" onClick={onClear}>Clear basket</button></div></> : <div className="empty-cart"><ShoppingBag size={28} /><p>Add products from the shop to get started.</p><button className="quiet-button" onClick={onClose}>Continue shopping</button></div>}</aside></div>;
}

function AuthModal({ onSuccess, onClose }) {
  const [mode, setMode] = useState('login'); const [fields, setFields] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  const submit = async (event) => { event.preventDefault(); setWorking(true); setError(''); try { const body = mode === 'login' ? { email: fields.email, password: fields.password } : { ...fields, role: 'customer' }; const result = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(body) }); localStorage.setItem('marketline_token', result.data.token); localStorage.setItem('marketline_user', JSON.stringify(result.data.user)); onSuccess(result.data.user); } catch (err) { setError(err.message); } finally { setWorking(false); } };
  return <div className="modal-backdrop"><section className="auth-modal"><button className="close-modal" onClick={onClose} aria-label="Close sign in"><X size={19} /></button><p className="eyebrow">Marketline account</p><h2>{mode === 'login' ? 'Welcome back.' : 'Make grocery days simpler.'}</h2><p className="modal-copy">{mode === 'login' ? 'Sign in to place orders and keep track of deliveries.' : 'Create a customer account to order from the live catalog.'}</p><form onSubmit={submit}>{mode === 'register' && <label>Name<input required value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} /></label>}<label>Email<input required type="email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} /></label><label>Password<input required minLength="6" type="password" value={fields.password} onChange={(event) => setFields({ ...fields, password: event.target.value })} /></label>{error && <p className="form-message">{error}</p>}<button className="primary-button full-button" disabled={working}>{working ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button></form><button className="switch-auth" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></section></div>;
}

function Orders({ user, onAuth }) {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(Boolean(user)); const [error, setError] = useState('');
  useEffect(() => { if (!user) return; api('/orders').then((body) => setOrders(body.data.orders)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [user]);
  if (!user) return <section className="center-page"><Package size={28} /><h1>Sign in to see your orders.</h1><p>Your order history and delivery updates will appear here.</p><button className="primary-button" onClick={onAuth}>Sign in <ArrowRight size={16} /></button></section>;
  return <section className="orders-page"><div className="section-heading"><div><p className="eyebrow">Your account</p><h1>Orders</h1></div><div className="order-caption"><Clock3 size={17} />Live status from the delivery workflow</div></div>{loading ? <div className="state-panel"><div className="loader" /><span>Loading your orders</span></div> : error ? <div className="state-panel error-state"><strong>Orders unavailable</strong><span>{error}</span></div> : orders.length === 0 ? <div className="state-panel"><Package size={22} /><span>No orders yet. Your next shop will show up here.</span></div> : <div className="orders-list">{orders.map((order) => <article className="order-row" key={order._id}><div><span className="order-number">Order {order._id.slice(-6).toUpperCase()}</span><strong>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</strong><small>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div><div className="order-status"><span className={`status status-${order.status.toLowerCase()}`}>{order.status.replaceAll('_', ' ')}</span><strong>{money.format(order.totalAmount)}</strong></div></article>)}</div>}</section>;
}

function LegalPage({ type, navigate }) { const privacy = type === 'privacy'; return <section className="legal-page"><p className="eyebrow">Marketline / {privacy ? 'Privacy' : 'Terms'}</p><h1>{privacy ? 'Privacy policy' : 'Terms and conditions'}</h1><p className="legal-lede">{privacy ? 'A straightforward account of the information this local grocery service uses.' : 'The practical rules for using Marketline to browse and place grocery orders.'}</p><div className="legal-copy">{privacy ? <><h2>What we collect</h2><p>We collect the name, email address, phone number, delivery address, and order information you provide when you create an account or place an order.</p><h2>How we use it</h2><p>We use this information to authenticate your account, fulfil orders, resolve delivery issues, and keep order history available to you. We do not sell personal information.</p><h2>Storage and access</h2><p>Account and order data is stored by the service backend. You can request access or deletion by contacting the service operator through the configured support channel.</p></> : <><h2>Using the service</h2><p>You must provide accurate account and delivery information. Keep your password private and tell us promptly if you believe your account has been accessed without permission.</p><h2>Orders and delivery</h2><p>An order is accepted only when the service confirms available stock and a serviceable delivery location. Availability, pricing, and delivery timing may change before confirmation.</p><h2>Account closure</h2><p>We may suspend access for misuse, fraud, or activity that could harm the service or other customers. You may stop using your account at any time.</p></>}<p className="last-updated">Last updated: September 4, 2026</p></div><button className="quiet-button" onClick={() => navigate('shop')}>Return to shop <ArrowRight size={16} /></button></section>; }

function Footer({ navigate }) { return <footer className="site-footer"><div><span className="footer-brand">Marketline</span><span className="footer-note">Everyday groceries, clearly delivered.</span></div><div className="footer-links"><button onClick={() => navigate('privacy')}>Privacy</button><button onClick={() => navigate('terms')}>Terms</button></div></footer>; }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
