import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, assetUrl } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import FoodVisual from '../../components/FoodVisual';
import Icon from '../../components/Icon';
import ImageEditor from '../../components/ImageEditor';
import Modal from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import type { Category, MenuItem, StockItem } from '../../types';

interface FormState {
  name: string;
  description: string;
  price: string;
  /** Optional: empty = no half plate */
  halfPrice: string;
  category: string;
}

const loadMenuData = () => Promise.all([api.menu.getAll(), api.categories.getAll(), api.stock.list()]);

export default function MenuManagement() {
  const { money } = useRestaurant();
  const toast = useToast();
  const { data, error, loading, retry, setData } = usePolling(loadMenuData);
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [filter, setFilter] = useState('all');
  const [removing, setRemoving] = useState<Category | null>(null);

  if (loading && !data) return <LoadingState label="Loading menu…" />;
  if (!data) return <ErrorState error={error} onRetry={retry} />;
  const [items, categories, stock] = data;

  const setItems = (fn: (prev: MenuItem[]) => MenuItem[]) => setData(([i, c, st]) => [fn(i), c, st]);
  const setCategories = (fn: (prev: Category[]) => Category[]) => setData(([i, c, st]) => [i, fn(c), st]);

  async function toggleAvailable(item: MenuItem) {
    try {
      const updated = await api.menu.update(item.id, { available: !item.available });
      setItems((prev) => prev.map((m) => (m.id === item.id ? updated : m)));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(item: MenuItem) {
    if (!confirm(`Delete “${item.name}” from the menu?`)) return;
    try {
      await api.menu.delete(item.id);
      setItems((prev) => prev.filter((m) => m.id !== item.id));
      toast.success('Item deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function saved(item: MenuItem) {
    setItems((prev) => (prev.some((m) => m.id === item.id) ? prev.map((m) => (m.id === item.id ? item : m)) : [...prev, item]));
    setEditing(null);
    toast.success('Menu saved');
  }

  return (
    <>
      <PageHeader
        icon="menu"
        title="Menu"
        subtitle="What guests can order. Changes show on table menus within seconds."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={categories.length === 0}>
            <Icon name="plus" size={16} /> Add item
          </button>
        }
      />

      <CategoryManager
        categories={categories}
        items={items}
        active={filter}
        onSelect={setFilter}
        onAdded={(created) => { setCategories((prev) => [...prev, created]); setFilter(created.slug); }}
      />

      {categories.filter((c) => filter === 'all' || c.slug === filter).map((category) => {
        const list = items.filter((m) => m.category === category.slug);
        return (
          <section key={category.slug} className="card">
            <div className="card-header">
              <h2 className="card-title">{category.name}</h2>
              <div className="row">
                <span className="subtle">{list.length} {list.length === 1 ? 'item' : 'items'}</span>
                {filter === category.slug && (
                  <button className="btn btn-danger btn-sm" onClick={() => setRemoving(category)}>
                    <Icon name="trash" size={14} /> Remove category
                  </button>
                )}
              </div>
            </div>
            {list.length === 0 ? (
              <p className="muted">No items in this category yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th /><th>Name</th><th>Description</th><th className="num">Price</th><th>Available</th><th /></tr>
                  </thead>
                  <tbody>
                    {list.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="thumb"><FoodVisual imageUrl={item.imageUrl} category={item.category} iconSize={22} /></div>
                        </td>
                        <td><strong>{item.name}</strong></td>
                        <td className="muted">{item.description}</td>
                        <td className="num nowrap">
                          {money(item.price)}
                          {item.halfPrice != null && <div className="subtle" style={{ fontSize: 'var(--text-xs)' }}>Half {money(item.halfPrice)}</div>}
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${item.available ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => toggleAvailable(item)}
                            aria-pressed={item.available}
                          >
                            {item.available ? 'Available' : 'Not Available'}
                          </button>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(item)}>Edit</button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(item)} aria-label={`Delete ${item.name}`}>
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {categories.length === 0 && (
        <div className="card">
          <EmptyState icon="menu" title="Start with a category" text="Add a category such as “Teas” above, then add items to it." />
        </div>
      )}

      {removing && (
        <RemoveCategory
          category={removing}
          categories={categories}
          items={items}
          onClose={() => setRemoving(null)}
          onRemoved={(moved, target) => {
            setData(([i, c, st]) => [
              i.map((m) => (moved.includes(m.id) ? { ...m, category: target } : m)),
              c.filter((x) => x.slug !== removing.slug),
              st,
            ]);
            setRemoving(null);
            setFilter(moved.length ? target : 'all');
            toast.success(`“${removing.name}” removed`);
          }}
        />
      )}

      {editing && (
        <ItemForm
          item={editing === 'new' ? null : editing}
          categories={categories}
          stock={stock}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function CategoryManager({ categories, items, active, onSelect, onAdded }: {
  categories: Category[];
  items: MenuItem[];
  active: string;
  onSelect: (slug: string) => void;
  onAdded: (category: Category) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      onAdded(await api.categories.create(name));
      setName('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Categories</h2>
        <span className="subtle">Pick a category to show only its items</span>
      </div>
      <div className="stack">
        {categories.length > 0 && (
          <div className="segmented" role="tablist" aria-label="Filter by category" style={{ flexWrap: 'wrap' }}>
            {[{ slug: 'all', name: 'All' }, ...categories].map((c) => (
              <button key={c.slug} role="tab" aria-selected={active === c.slug} className="segmented-item" onClick={() => onSelect(c.slug)}>
                {c.name}
                <span className="segmented-count">{c.slug === 'all' ? items.length : items.filter((m) => m.category === c.slug).length}</span>
              </button>
            ))}
          </div>
        )}
        <form className="inline-form" onSubmit={add}>
          <label className="field">
            <span className="visually-hidden">New category name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Desserts" required />
          </label>
          <button className="btn btn-secondary" disabled={saving}><Icon name="plus" size={16} /> Add category</button>
        </form>
      </div>
    </section>
  );
}

/** Removes a category. Its items are first moved to another category, so no dish is lost. */
function RemoveCategory({ category, categories, items, onClose, onRemoved }: {
  category: Category;
  categories: Category[];
  items: MenuItem[];
  onClose: () => void;
  onRemoved: (movedIds: number[], target: string) => void;
}) {
  const toast = useToast();
  const others = categories.filter((c) => c.slug !== category.slug);
  const inside = items.filter((m) => m.category === category.slug);
  const [target, setTarget] = useState(others[0]?.slug ?? '');
  const [busy, setBusy] = useState(false);
  const blocked = inside.length > 0 && others.length === 0;

  async function confirmRemove() {
    setBusy(true);
    try {
      for (const m of inside) await api.menu.update(m.id, { category: target });
      await api.categories.delete(category.slug);
      onRemoved(inside.map((m) => m.id), target);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  const plural = inside.length === 1 ? 'item' : 'items';

  return (
    <Modal
      title={`Remove “${category.name}”`}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={confirmRemove} disabled={busy || blocked}>
          <Icon name="trash" size={16} /> {busy ? 'Removing…' : inside.length ? 'Move items & remove' : 'Remove category'}
        </button>
      </>}
    >
      {inside.length === 0 ? (
        <p className="muted">This category is empty. It will disappear from the menu, the POS and guest menus.</p>
      ) : blocked ? (
        <p className="alert alert-warning" style={{ marginBottom: 0 }}>
          “{category.name}” still has {inside.length} {plural} and there is no other category to move them to.
          Add another category first, or delete its items.
        </p>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
            “{category.name}” has {inside.length} {plural}: {inside.map((m) => m.name).join(', ')}.
            They will be moved before the category is removed.
          </p>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Move {plural} to</span>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        </>
      )}
    </Modal>
  );
}

interface RecipeRow { stockItemId: string; quantity: string }

function ItemForm({ item, categories, stock, onSaved, onClose }: {
  item: MenuItem | null;
  categories: Category[];
  stock: StockItem[];
  onSaved: (item: MenuItem) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item ? String(item.price) : '',
    halfPrice: item?.halfPrice != null ? String(item.halfPrice) : '',
    category: item?.category ?? categories[0]?.slug ?? '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(assetUrl(item?.imageUrl) ?? null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!item) return;
    api.menu.getRecipe(item.id).then(
      (rows) => setRecipe(rows.map((r) => ({ stockItemId: String(r.stockItemId), quantity: String(r.quantity) }))),
      () => toast.error('Could not load ingredients'),
    );
  }, [item, toast]);

  const setRow = (i: number, patch: Partial<RecipeRow>) => setRecipe((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setEditorSrc(URL.createObjectURL(file));
  }

  function applyEdit(blob: Blob) {
    setImageFile(new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    setImagePreview(URL.createObjectURL(blob));
    setEditorSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let imageUrl = imagePreview ? item?.imageUrl ?? null : null;
      if (imageFile) imageUrl = (await api.menu.uploadImage(imageFile, form.name)).imageUrl;

      if (form.halfPrice.trim() && !(Number(form.halfPrice) > 0)) throw new Error('Half plate price must be a positive number, or leave it empty');
      const payload = { ...form, price: Number(form.price), halfPrice: form.halfPrice.trim() ? Number(form.halfPrice) : null, imageUrl };
      const savedItem = item ? await api.menu.update(item.id, payload) : await api.menu.create(payload);
      await api.menu.setRecipe(savedItem.id, recipe
        .filter((r) => r.stockItemId && Number(r.quantity) > 0)
        .map((r) => ({ stockItemId: Number(r.stockItemId), quantity: Number(r.quantity) })));
      onSaved(savedItem);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        title={item ? 'Edit item' : 'Add menu item'}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" form="item-form" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button>
          </>
        }
      >
        <form id="item-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input" value={form.name} onChange={set('name')} required />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea className="input" rows={2} value={form.description} onChange={set('description')} />
          </label>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <label className="field spacer">
              <span className="field-label">Price</span>
              <input type="number" step="1" min="0" className="input" value={form.price} onChange={set('price')} required />
            </label>
            <label className="field spacer">
              <span className="field-label">Half plate price <span className="subtle">(optional)</span></span>
              <input type="number" step="1" min="0" className="input" value={form.halfPrice} onChange={set('halfPrice')} placeholder="No half plate" />
            </label>
            <label className="field spacer">
              <span className="field-label">Category</span>
              <select className="input" value={form.category} onChange={set('category')} required>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
          </div>
          {form.halfPrice.trim() !== '' && (
            <p className="field-hint" style={{ marginTop: 'calc(-1 * var(--space-2))', marginBottom: 'var(--space-4)' }}>
              Guests and the POS can choose Full or Half plate. The kitchen sees "Half plate" on the ticket, and a half plate uses half of the ingredients below.
            </p>
          )}
          <div className="field">
            <span className="field-label">Photo</span>
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorSrc(imagePreview)}>Edit photo</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={removeImage}>Remove</button>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="input" onChange={chooseFile} />
            <span className="field-hint">Up to 5 MB · JPG, PNG or WebP. Choosing a file opens the editor.</span>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Ingredients per serving</span>
            <span className="field-hint" style={{ marginBottom: 'var(--space-2)' }}>Each sale deducts these from stock automatically. Leave empty to skip stock tracking.</span>
            {recipe.map((r, i) => {
              const unit = stock.find((s) => String(s.id) === r.stockItemId)?.unit;
              return (
                <div key={i} className="line-editor two">
                  <select className="input" value={r.stockItemId} onChange={(e) => setRow(i, { stockItemId: e.target.value })} aria-label="Ingredient">
                    <option value="">Choose ingredient…</option>
                    {stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                  </select>
                  <input className="input" type="number" step="any" min="0" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} placeholder={unit ? `Qty (${unit})` : 'Qty'} aria-label="Quantity per serving" />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setRecipe((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove ingredient"><Icon name="close" size={16} /></button>
                </div>
              );
            })}
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setRecipe((rows) => [...rows, { stockItemId: '', quantity: '' }])} disabled={stock.length === 0}>
              <Icon name="plus" size={14} /> Add ingredient
            </button>
          </div>
        </form>
      </Modal>

      {editorSrc && <ImageEditor src={editorSrc} onSave={applyEdit} onCancel={() => setEditorSrc(null)} />}
    </>
  );
}
