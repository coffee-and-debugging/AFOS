import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, assetUrl } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import ExpandableText from '../../components/ExpandableText';
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
  /** Optional, display only */
  ingredients: string;
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
  const [editingCategories, setEditingCategories] = useState(false);

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
        onEdit={() => setEditingCategories(true)}
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
                        <td className="muted">
                          <ExpandableText text={item.description} className="cell-clamp" />
                          {item.ingredients && <div className="cell-sub cell-clamp-1" title={item.ingredients}>Ingredients: {item.ingredients}</div>}
                        </td>
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
          <EmptyState icon="menu" title="No categories yet" />
        </div>
      )}

      {editingCategories && (
        <CategoryEditor
          categories={categories}
          items={items}
          onChanged={(next) => setCategories(() => next)}
          onRemove={(c) => { setEditingCategories(false); setRemoving(c); }}
          onClose={() => setEditingCategories(false)}
        />
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

function CategoryManager({ categories, items, active, onSelect, onAdded, onEdit }: {
  categories: Category[];
  items: MenuItem[];
  active: string;
  onSelect: (slug: string) => void;
  onAdded: (category: Category) => void;
  onEdit: () => void;
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
        <div className="row">
          <span className="subtle">Pick a category to show only its items</span>
          {categories.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={onEdit}><Icon name="edit" size={14} /> Edit</button>
          )}
        </div>
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
            <input className="input" data-icon="tag" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" required />
          </label>
          <button className="btn btn-secondary" disabled={saving}><Icon name="plus" size={16} /> Add category</button>
        </form>
      </div>
    </section>
  );
}

/** Rename categories and change the order they appear in on the menu, POS and guest pages. */
function CategoryEditor({ categories, items, onChanged, onRemove, onClose }: {
  categories: Category[];
  items: MenuItem[];
  onChanged: (next: Category[]) => void;
  onRemove: (category: Category) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(categories.map((c) => [c.slug, c.name])));
  const [busy, setBusy] = useState<string | null>(null);

  async function rename(c: Category) {
    const name = (names[c.slug] ?? '').trim();
    if (!name || name === c.name) return;
    setBusy(c.slug);
    try {
      const updated = await api.categories.rename(c.slug, name);
      onChanged(categories.map((x) => (x.slug === c.slug ? updated : x)));
      toast.success(`Renamed to “${updated.name}”`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, delta: number) {
    const next = [...categories];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    setBusy(moved.slug);
    try {
      await api.categories.reorder(next.map((c) => c.slug));
      onChanged(next.map((c, i) => ({ ...c, sortOrder: i + 1 })));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title="Edit categories" onClose={onClose} footer={<button className="btn btn-secondary" onClick={onClose}>Done</button>}>
      <ul className="category-edit">
        {categories.map((c, i) => {
          const count = items.filter((m) => m.category === c.slug).length;
          const changed = (names[c.slug] ?? '').trim() !== c.name;
          return (
            <li key={c.slug}>
              <div className="category-edit-move">
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => move(i, -1)} disabled={i === 0 || busy !== null} aria-label={`Move ${c.name} up`}><Icon name="arrowUp" size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => move(i, 1)} disabled={i === categories.length - 1 || busy !== null} aria-label={`Move ${c.name} down`}><Icon name="arrowDown" size={14} /></button>
              </div>
              <form className="category-edit-name" onSubmit={(e) => { e.preventDefault(); rename(c); }}>
                <input
                  className="input"
                  value={names[c.slug] ?? ''}
                  onChange={(e) => setNames((n) => ({ ...n, [c.slug]: e.target.value }))}
                  maxLength={40}
                  placeholder="Category name"
                  aria-label={`Name for ${c.name}`}
                />
                {changed && <button className="btn btn-primary btn-sm" disabled={busy !== null || !(names[c.slug] ?? '').trim()}>Save</button>}
              </form>
              <span className="subtle nowrap">{count} {count === 1 ? 'item' : 'items'}</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onRemove(c)} aria-label={`Remove ${c.name}`} title="Remove category"><Icon name="trash" size={14} /></button>
            </li>
          );
        })}
      </ul>
    </Modal>
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
        <p className="muted">This category is empty.</p>
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
            <select className="input" data-icon="tag" value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        </>
      )}
    </Modal>
  );
}

/** Optional link to an inventory item: each sale deducts `quantity` of it */
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
    ingredients: item?.ingredients ?? '',
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
      () => toast.error('Could not load inventory links'),
    );
  }, [item, toast]);

  const setRow = (i: number, patch: Partial<RecipeRow>) => setRecipe((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  function clearFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Any format the browser can decode opens in the editor, which crops it to the fixed 4:3 menu frame
  // and saves a JPEG, so every photo displays the same everywhere.
  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => setEditorSrc(url);
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      clearFileInput();
      const ext = file.name.split('.').pop()?.toUpperCase() || 'this';
      toast.error(`This browser can't open ${ext} images. Save the photo as JPG or PNG and try again.`);
    };
    probe.src = url;
  }

  function cancelEdit() {
    setEditorSrc(null);
    clearFileInput(); // so picking the same file again reopens the editor
  }

  function applyEdit(blob: Blob) {
    setImageFile(new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    setImagePreview(URL.createObjectURL(blob));
    setEditorSrc(null);
    clearFileInput();
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    clearFileInput();
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
            <input className="input" data-icon="food" value={form.name} placeholder="Dish name" onChange={set('name')} required />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea className="input" data-icon="note" rows={2} value={form.description} placeholder="About this dish" onChange={set('description')} />
          </label>
          <label className="field">
            <span className="field-label">Ingredients <span className="subtle">(optional)</span></span>
            <input className="input" data-icon="list" value={form.ingredients} onChange={set('ingredients')} maxLength={1000} placeholder="Chicken, cheese, lettuce" />
          </label>
          {/* Equal columns with one-line labels, so all three inputs sit on the same line */}
          <div className="grid-3 price-row">
            <label className="field">
              <span className="field-label">Price</span>
              <input type="number" step="1" min="0" className="input" data-icon="money" value={form.price} placeholder="0" onChange={set('price')} required />
            </label>
            <label className="field">
              <span className="field-label">Half plate price</span>
              <input type="number" step="1" min="0" className="input" data-icon="money" value={form.halfPrice} onChange={set('halfPrice')} placeholder="Optional" />
            </label>
            <label className="field">
              <span className="field-label">Category</span>
              <select className="input" data-icon="tag" value={form.category} onChange={set('category')} required>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="field">
            <span className="field-label">Photo</span>
            {imagePreview && (
              <div className="image-preview">
                <div className="image-preview-frame"><img src={imagePreview} alt="Preview" /></div>
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorSrc(imagePreview)}>Edit photo</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={removeImage}>Remove</button>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,.svg,.heic,.heif,.tif,.tiff" className="input" onChange={chooseFile} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Link to inventory <span className="subtle">(optional)</span></span>
            {recipe.map((r, i) => {
              const unit = stock.find((s) => String(s.id) === r.stockItemId)?.unit;
              return (
                <div key={i} className="line-editor two">
                  <select className="input" data-icon="box" value={r.stockItemId} onChange={(e) => setRow(i, { stockItemId: e.target.value })} aria-label="Inventory item">
                    <option value="">Choose inventory item…</option>
                    {stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                  </select>
                  <input className="input" data-icon="hash" type="number" step="any" min="0" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} placeholder={unit ? `Qty (${unit})` : 'Qty'} aria-label="Quantity deducted per sale" />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setRecipe((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove inventory link"><Icon name="close" size={16} /></button>
                </div>
              );
            })}
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setRecipe((rows) => [...rows, { stockItemId: '', quantity: '' }])} disabled={stock.length === 0}>
              <Icon name="plus" size={14} /> Link inventory item
            </button>
          </div>
        </form>
      </Modal>

      {editorSrc && <ImageEditor src={editorSrc} onSave={applyEdit} onCancel={cancelEdit} />}
    </>
  );
}
