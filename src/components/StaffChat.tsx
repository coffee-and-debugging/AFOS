import { useEffect, useRef, useState, type FormEvent } from 'react';
import Icon from './Icon';
import { api, getAuthUser } from '../api/client';
import { useLiveEvent, useLiveReload, usePolling, useToast } from '../hooks';
import { formatTime } from '../lib/format';
import { playChatPing } from '../lib/sound';
import type { ChatMessage, Role } from '../types';
// Developed by Unique Adhikari

const ROLE_NAME: Record<Role, string> = { admin: 'Admin', cashier: 'Cashier', chef: 'Kitchen' };
const ALL_ROLES: Role[] = ['chef', 'cashier', 'admin'];

/** Top-bar chat between the kitchen, the cashier and the admin, e.g. "we need 5 kg chicken". */
export default function StaffChat() {
  const me = getAuthUser()?.role ?? 'admin';
  const peers = ALL_ROLES.filter((r) => r !== me);
  const toast = useToast();
  const { data: unread, reload, setData: setUnread } = usePolling(api.chat.unread, 60_000);
  const [open, setOpen] = useState(false);
  const [peer, setPeer] = useState<Role>(peers[0]);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const total = peers.reduce((s, r) => s + (unread?.[r] ?? 0), 0);

  // Load the open conversation and mark it read
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMessages(null);
    api.chat.list(peer).then((list) => { if (!cancelled) setMessages(list); }, (err) => toast.error((err as Error).message));
    if (unread?.[peer]) {
      api.chat.markRead(peer).catch(() => {});
      setUnread((u) => ({ ...u, [peer]: 0 }));
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the conversation changes
  }, [open, peer]);

  // Keep the newest message in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useLiveReload(reload, ['chat.read']);
  useLiveEvent('chat.message', (m) => {
    const other = m.fromRole === me ? m.toRole : m.fromRole;
    if (open && other === peer) {
      setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
      if (m.fromRole !== me) api.chat.markRead(peer).catch(() => {});
    } else if (m.fromRole !== me) {
      setUnread((u) => ({ ...u, [m.fromRole]: (u[m.fromRole] ?? 0) + 1 }));
    }
    if (m.fromRole !== me) playChatPing();
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      // Open on the conversation with the most unread messages
      const busiest = [...peers].sort((a, b) => (unread?.[b] ?? 0) - (unread?.[a] ?? 0))[0];
      if (unread?.[busiest]) setPeer(busiest);
    }
    setOpen((o) => !o);
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await api.chat.send(peer, body);
      setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
      setText('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="alert-bell" ref={panelRef}>
      <button
        className={`btn btn-ghost btn-icon${total ? ' has-alerts' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label={total ? `Messages, ${total} unread` : 'Messages'}
        title="Messages"
      >
        <Icon name="chat" size={18} />
        {total > 0 && <span className="alert-bell-count">{total > 99 ? '99+' : total}</span>}
      </button>

      {open && (
        <div className="alert-panel chat-panel" role="dialog" aria-label="Messages">
          <div className="alert-panel-head">
            <div className="alert-panel-title">Messages</div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Close messages">
              <Icon name="close" size={16} />
            </button>
          </div>

          <div className="chat-tabs segmented" role="tablist" aria-label="Chat with">
            {peers.map((r) => (
              <button key={r} role="tab" aria-selected={peer === r} className="segmented-item" onClick={() => setPeer(r)}>
                {ROLE_NAME[r]}
                {(unread?.[r] ?? 0) > 0 && <span className="segmented-count">{unread![r]}</span>}
              </button>
            ))}
          </div>

          <div className="chat-list" ref={listRef}>
            {messages === null ? (
              <p className="chat-empty">Loading…</p>
            ) : messages.length === 0 ? (
              <p className="chat-empty">No messages with {ROLE_NAME[peer]} yet.</p>
            ) : messages.map((m) => (
              <div key={m.id} className={`chat-msg${m.fromRole === me ? ' is-mine' : ''}`}>
                <div className="chat-bubble">{m.body}</div>
                <div className="chat-meta">{m.fromRole === me ? 'You' : m.fromName} · {formatTime(m.createdAt)}</div>
              </div>
            ))}
          </div>

          <form className="chat-compose" onSubmit={send}>
            <textarea
              className="input"
              rows={1}
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${ROLE_NAME[peer]}…`}
              aria-label={`Message ${ROLE_NAME[peer]}`}
            />
            <button className="btn btn-primary btn-icon" disabled={sending || !text.trim()} aria-label="Send">
              <Icon name="send" size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
