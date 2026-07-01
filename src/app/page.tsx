'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/authed-fetch';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Key,
  Image as ImageIcon,
  Loader2,
  Download,
  X,
  Upload,
  Trash2,
  Check,
  Copy,
  AlertCircle,
  Clock,
  Settings2,
  ZoomIn,
  ExternalLink,
  Wand2,
  Ratio,
  Monitor,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  LogOut,
  History,
  CopyCheck,
  User,
  Eye,
  PenLine,
  Menu,
  ChevronDown,
  ChevronUp,
  Library,
  BookmarkPlus,
  Edit3,
  Search,
  Star,
  Plus,
  XIcon,
  Filter,
  Tag,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { withBase } from '@/lib/base-path';
import type { HistoryItem } from '@/lib/types';
import { useHistorySync } from '@/hooks/use-history-sync';
import { HistorySyncIndicator } from '@/components/history-sync-indicator';

type Theme = 'light' | 'dark';
type UiSize = 'compact' | 'default' | 'comfortable';
type PromptMode = 'edit' | 'preview';

interface UserInfo {
  username: string;
  displayName: string;
}

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl-default-ecommerce',
    title: '电商主图（白底）',
    content: '{product}，专业电商产品摄影，纯白背景，柔和均匀的影棚灯光，高清细节，主体居中，商业级质感',
    category: '电商',
    tags: ['电商', '白底', '产品'],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'tpl-default-portrait',
    title: '人物肖像',
    content: 'cinematic portrait of {subject}, shallow depth of field, 85mm lens, soft natural lighting, detailed skin texture, bokeh background',
    category: '人物',
    tags: ['人物', '人像', '电影感'],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'tpl-default-cyberpunk',
    title: '赛博朋克场景',
    content: '赛博朋克城市街景，霓虹灯光映照在湿润的柏油路面，飞行汽车，巨型全息广告，Blade Runner 2049 风格，电影级构图',
    category: '场景',
    tags: ['赛博朋克', '夜景', '科幻'],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'tpl-default-illustration',
    title: '水墨插画',
    content: '水墨画风格，{subject}，留白意境，宣纸纹理，晕染笔触，传统东方美学',
    category: '风格',
    tags: ['水墨', '插画', '东方'],
    createdAt: 0,
    updatedAt: 0,
  },
];

const TEMPLATE_CATEGORIES = ['全部', '人物', '电商', '场景', '风格', '其他'];

interface TaskResult {
  status: 'submitted' | 'processing' | 'completed' | 'failed';
  taskId: string;
  prompt: string;
  size: string;
  resolution: string;
  createdAt: number;
  completedAt?: number;
  progress: number;
  imageUrl?: string;
  error?: string;
}

type ApiError = {
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
  message?: string;
};

// ---- Constants ----
const SIZE_OPTIONS = [
  { value: 'auto', label: 'Auto', category: 'auto' },
  { value: '1:1', label: '1:1', category: 'square' },
  { value: '3:2', label: '3:2', category: 'landscape' },
  { value: '2:3', label: '2:3', category: 'portrait' },
  { value: '4:3', label: '4:3', category: 'landscape' },
  { value: '3:4', label: '3:4', category: 'portrait' },
  { value: '5:4', label: '5:4', category: 'landscape' },
  { value: '4:5', label: '4:5', category: 'portrait' },
  { value: '16:9', label: '16:9', category: 'landscape' },
  { value: '9:16', label: '9:16', category: 'portrait' },
  { value: '2:1', label: '2:1', category: 'landscape' },
  { value: '1:2', label: '1:2', category: 'portrait' },
  { value: '3:1', label: '3:1', category: 'landscape' },
  { value: '1:3', label: '1:3', category: 'portrait' },
  { value: '21:9', label: '21:9', category: 'landscape' },
  { value: '9:21', label: '9:21', category: 'portrait' },
];

const RESOLUTION_OPTIONS = [
  { value: '1k', label: '1K', desc: '快速' },
  { value: '2k', label: '2K', desc: '高清' },
  { value: '4k', label: '4K', desc: '极致' },
];

const PROMPT_PRESETS = [
  { text: '橘猫与夕阳', prompt: '一只橘猫坐在窗台上看夕阳，水彩画风格，温暖的光影' },
  { text: '柯基宇航员', prompt: 'a corgi astronaut on the moon, cinematic lighting, 8k' },
  { text: '星空古堡', prompt: '星空下的古老城堡，史诗级光影，银河可见' },
  { text: '赛博雨夜', prompt: '赛博朋克城市街道，霓虹灯光映照在雨水中，Blade Runner 风格' },
  { text: '水墨远山', prompt: '水墨山水画，云雾缭绕的远山，留白意境，宣纸质感' },
  { text: '蒸汽波日落', prompt: '蒸汽波风格的日落海滩，粉紫色天空，棕榈树剪影' },
];

const API_KEY_STORAGE_KEY = 'gpt-image-studio-api-key';
const THEME_STORAGE_KEY = 'gpt-image-studio-theme';
const UI_SIZE_STORAGE_KEY = 'gpt-image-studio-ui-size';
const HISTORY_STORAGE_KEY = 'gpt-image-studio-history';
const TEMPLATES_STORAGE_KEY = 'gpt-image-studio-templates';
const TEMPLATES_SEEDED_KEY = 'gpt-image-studio-templates-seeded';
const MAX_HISTORY_ITEMS = 500;

// ---- Helpers ----
function extractErrorMessage(data: ApiError): string {
  if (data.error?.message) return data.error.message;
  if (data.message) return data.message;
  return '未知错误，请稍后重试';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Aspect ratio visual indicator ----
function AspectPreview({ ratio }: { ratio: string }) {
  if (ratio === 'auto') return <div className="w-3 h-3 rounded-sm border border-current/30" />;
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return null;
  const scale = 12 / Math.max(w, h);
  return (
    <div
      className="border border-current/30 rounded-[1px]"
      style={{ width: w * scale, height: h * scale }}
    />
  );
}

// ---- TagEditPopover (small helper component for adding tags to images) ----
function TagEditPopover({
  tags,
  suggestions,
  onAdd,
  onRemove,
}: {
  tags: string[];
  suggestions: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const trimmed = draft.trim();
  const lower = trimmed.toLowerCase();
  const filteredSuggestions = trimmed
    ? suggestions.filter((s) => !tags.includes(s) && s.toLowerCase().includes(lower))
    : suggestions.filter((s) => !tags.includes(s));

  const commit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setDraft('');
      return;
    }
    onAdd(v);
    setDraft('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDraft('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-7 rounded-lg flex items-center justify-center bg-black/30 backdrop-blur-sm text-white/80 hover:bg-black/50 hover:text-white transition-all duration-200"
          title="添加标签"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">添加标签</p>
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit(draft);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              placeholder="输入后回车..."
              className="h-7 text-[11px]"
              maxLength={20}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              onClick={() => commit(draft)}
              disabled={!trimmed}
            >
              添加
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border/40">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary"
                >
                  {t}
                  <button
                    onClick={() => onRemove(t)}
                    className="hover:text-destructive"
                    title="移除"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {filteredSuggestions.length > 0 && (
            <div className="pt-1 border-t border-border/40">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 px-1 pb-1">建议</p>
              <div className="flex items-center gap-1 flex-wrap">
                {filteredSuggestions.slice(0, 10).map((s) => (
                  <button
                    key={s}
                    onClick={() => commit(s)}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted hover:bg-muted/70 text-foreground/70"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---- Login Page Component ----
function LoginPage({ onLogin }: { onLogin: (user: UserInfo, token?: string | null) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(withBase('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        // 把 token 一并交给父组件，父组件会持久化到 localStorage
        onLogin(data.data, data.data?.token ?? null);
      } else {
        setError(data.error || '登录失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[400px]">
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-8 sm:mb-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-lg shadow-primary/15 ring-1 ring-primary/10 mb-4 sm:mb-5">
            <img src={withBase("/logo.png")} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">GPT Image Studio</h1>
          <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-1.5">登录以使用 AI 图片生成服务</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs text-muted-foreground">用户名</Label>
            <Input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-muted-foreground">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[12px] text-destructive bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-lg transition-colors"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '登录'}
          </Button>

          <div className="text-center">
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
              没有账号？请联系微信 <span className="font-medium text-muted-foreground/70">sgl810</span> 获取登录凭证
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Mobile Menu for Header ----
function MobileHeaderMenu({
  user,
  apiKey,
  onOpenApiKey,
  onOpenHistory,
  onOpenTemplates,
  onOpenPrefs,
  onLogout,
  historyCount,
  templatesCount,
}: {
  user: UserInfo | null;
  apiKey: string;
  onOpenApiKey: () => void;
  onOpenHistory: () => void;
  onOpenTemplates: () => void;
  onOpenPrefs: () => void;
  onLogout: () => void;
  historyCount: number;
  templatesCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded-lg flex items-center justify-center border border-border/60 hover:bg-primary/10 hover:border-primary/20 transition-all"
      >
        {open ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-border/60 bg-card shadow-lg shadow-black/5 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Status */}
            <div className="px-3 py-2 border-b border-border/30">
              {apiKey ? (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  API 已连接
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-primary/60">
                  <AlertCircle className="w-3 h-3" />
                  API 未配置
                </div>
              )}
            </div>

            <button
              onClick={() => { onOpenApiKey(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground/80 hover:bg-primary/5 transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-muted-foreground" />配置 API Key
            </button>
            <button
              onClick={() => { onOpenHistory(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground/80 hover:bg-primary/5 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-muted-foreground" />
              生成历史
              {historyCount > 0 && (
                <span className="text-[9px] bg-primary/15 text-primary px-1.5 rounded-full font-medium">{historyCount}</span>
              )}
            </button>
            <button
              onClick={() => { onOpenTemplates(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground/80 hover:bg-primary/5 transition-colors"
            >
              <Library className="w-3.5 h-3.5 text-muted-foreground" />
              提示词模板
              {templatesCount > 0 && (
                <span className="text-[9px] bg-primary/15 text-primary px-1.5 rounded-full font-medium">{templatesCount}</span>
              )}
            </button>
            <button
              onClick={() => { onOpenPrefs(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground/80 hover:bg-primary/5 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />偏好设置
            </button>

            <div className="border-t border-border/30 mt-1.5 pt-1.5">
              <div className="px-3 py-1.5 flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                  <User className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{user?.displayName || '未登录'}</span>
              </div>
              <button
                onClick={() => { onLogout(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />退出登录
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Main App Component ----
function MainApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [promptMode, setPromptMode] = useState<PromptMode>('edit');
  const [size, setSize] = useState('1:1');
  const [resolution, setResolution] = useState('1k');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceFileNames, setReferenceFileNames] = useState<string[]>([]);
  const [paramsExpanded, setParamsExpanded] = useState(true);

  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [copiedImageUrl, setCopiedImageUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>('light');
  const [uiSize, setUiSize] = useState<UiSize>('default');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Template library state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('全部');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ title: '', content: '', category: '其他', tagsInput: '' });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Gallery filter state (favorites + tags)
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'favorites'>('all');
  const [galleryTagFilter, setGalleryTagFilter] = useState<string | null>(null);
  const [tagEditPopover, setTagEditPopover] = useState<{ taskId: string; input: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const historyRef = useRef<HistoryItem[]>([]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const { status: syncStatus, queueUpsert, queueDelete, flushNow } = useHistorySync({
    isAuthenticated: !!user,
    setLocalHistory: setHistory,
    localHistoryRef: historyRef,
  });

  // Load persisted state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (stored) { setApiKey(stored); setApiKeyInput(stored); }
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (storedTheme === 'light' || storedTheme === 'dark') setTheme(storedTheme);
      const storedSize = localStorage.getItem(UI_SIZE_STORAGE_KEY) as UiSize | null;
      if (storedSize === 'compact' || storedSize === 'default' || storedSize === 'comfortable') setUiSize(storedSize);
      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        try {
          const parsed = JSON.parse(storedHistory);
          if (Array.isArray(parsed)) {
            const migrated = parsed.map((h) => ({
              ...h,
              tags: Array.isArray(h.tags) ? h.tags : [],
              favorited: typeof h.favorited === 'boolean' ? h.favorited : false,
            }));
            setHistory(migrated);
          }
        } catch { /* ignore */ }
      }
      // Templates: seed defaults on first run, then load
      const seeded = localStorage.getItem(TEMPLATES_SEEDED_KEY);
      const storedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (storedTemplates) {
        try {
          const parsed = JSON.parse(storedTemplates) as Template[];
          setTemplates(Array.isArray(parsed) ? parsed : []);
        } catch { /* ignore */ }
      } else if (!seeded) {
        const now = Date.now();
        const seededTemplates = DEFAULT_TEMPLATES.map((t) => ({ ...t, createdAt: now, updatedAt: now }));
        setTemplates(seededTemplates);
        try { localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(seededTemplates)); } catch { /* ignore */ }
        try { localStorage.setItem(TEMPLATES_SEEDED_KEY, '1'); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  // Apply theme & size to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', theme === 'dark');
    html.setAttribute('data-ui-size', uiSize);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(UI_SIZE_STORAGE_KEY, uiSize);
    } catch { /* ignore */ }
  }, [theme, uiSize]);

  // Save history to localStorage
  useEffect(() => {
    try { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history)); } catch { /* ignore */ }
  }, [history]);

  // Save templates to localStorage
  useEffect(() => {
    try { localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates)); } catch { /* ignore */ }
  }, [templates]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // Generate stable unique id for templates
  const generateId = () => `tpl-${crypto.randomUUID()}`;

  const showToast = (type: 'success' | 'error', message: string) => setToast({ type, message });

  // Open save-template dialog with current prompt pre-filled
  const openSaveTemplate = (overrides?: { title?: string; content?: string }) => {
    setEditingTemplate(null);
    setTemplateForm({
      title: overrides?.title ?? '',
      content: overrides?.content ?? prompt,
      category: '其他',
      tagsInput: '',
    });
    setSaveTemplateOpen(true);
  };

  // Open save-template dialog to edit an existing template
  const openEditTemplate = (tpl: Template) => {
    setEditingTemplate(tpl);
    setTemplateForm({
      title: tpl.title,
      content: tpl.content,
      category: tpl.category,
      tagsInput: tpl.tags.join(', '),
    });
    setSaveTemplateOpen(true);
  };

  // Persist the template form (create or update)
  const handleSaveTemplate = () => {
    const title = templateForm.title.trim();
    const content = templateForm.content.trim();
    if (!title) { showToast('error', '请填写模板标题'); return; }
    if (!content) { showToast('error', '模板内容不能为空'); return; }
    const tags = templateForm.tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
    const now = Date.now();
    if (editingTemplate) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, title, content, category: templateForm.category, tags, updatedAt: now }
            : t
        )
      );
      showToast('success', '模板已更新');
    } else {
      const newTemplate: Template = {
        id: generateId(),
        title,
        content,
        category: templateForm.category,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      setTemplates((prev) => [newTemplate, ...prev]);
      showToast('success', '已保存为模板');
    }
    setSaveTemplateOpen(false);
    setEditingTemplate(null);
  };

  // Delete a template
  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast('success', '模板已删除');
  };

  // Insert template content into the prompt editor
  // mode: 'replace' | 'append'
  const insertTemplate = (tpl: Template, mode: 'replace' | 'append' = 'append') => {
    setPromptMode('edit');
    setPrompt((prev) => {
      if (mode === 'replace' || !prev.trim()) return tpl.content;
      const separator = prev.endsWith('\n') || tpl.content.startsWith('\n') ? '' : '\n\n';
      return `${prev}${separator}${tpl.content}`;
    });
    setTemplatesOpen(false);
    showToast('success', `已插入模板：${tpl.title}`);
  };

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates.filter((t) => {
      if (templateCategory !== '全部' && t.category !== templateCategory) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [templates, templateSearch, templateCategory]);

  const handleSaveApiKey = useCallback(() => {
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      setApiKey(trimmed);
      try { localStorage.setItem(API_KEY_STORAGE_KEY, trimmed); } catch { /* ignore */ }
      setApiKeySaved(true);
      setTimeout(() => { setApiKeySaved(false); setApiKeyDialogOpen(false); }, 800);
    }
  }, [apiKeyInput]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (referenceImages.length >= 16) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          setReferenceImages((prev) => [...prev, result]);
          setReferenceFileNames((prev) => [...prev, file.name]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [referenceImages.length]);

  const handleRemoveRefImage = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setReferenceFileNames((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addToHistory = useCallback((item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((p) => p.taskId !== item.taskId)];
      return next.slice(0, MAX_HISTORY_ITEMS);
    });
    queueUpsert(item);
  }, [queueUpsert]);

  const deleteHistoryItem = useCallback((taskId: string) => {
    setHistory((prev) => prev.filter((h) => h.taskId !== taskId));
    queueDelete(taskId);
  }, [queueDelete]);

  const clearHistory = useCallback(() => {
    historyRef.current.forEach((item) => queueDelete(item.taskId));
    setHistory([]);
  }, [queueDelete]);

  const toggleFavorite = useCallback((taskId: string) => {
    setHistory((prev) => {
      const updated = prev.map((h) =>
        h.taskId === taskId ? { ...h, favorited: !h.favorited } : h
      );
      const item = updated.find((h) => h.taskId === taskId);
      if (item) queueUpsert(item);
      return updated;
    });
  }, [queueUpsert]);

  const addTag = useCallback((taskId: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const updated = prev.map((h) => {
        if (h.taskId !== taskId) return h;
        if (h.tags.includes(trimmed)) return h;
        return { ...h, tags: [...h.tags, trimmed] };
      });
      const item = updated.find((h) => h.taskId === taskId);
      if (item) queueUpsert(item);
      return updated;
    });
  }, [queueUpsert]);

  const removeTag = useCallback((taskId: string, tag: string) => {
    setHistory((prev) => {
      const updated = prev.map((h) =>
        h.taskId === taskId ? { ...h, tags: h.tags.filter((t) => t !== tag) } : h
      );
      const item = updated.find((h) => h.taskId === taskId);
      if (item) queueUpsert(item);
      return updated;
    });
  }, [queueUpsert]);

  const MAX_POLLING_DURATION_MS = 180_000;

  const pollTaskStatus = useCallback((taskId: string, userApiKey: string) => {
    const startTime = Date.now();

    const persistFailedToHistory = (errorMsg: string) => {
      const task = tasks.find((t) => t.taskId === taskId);
      addToHistory({
        taskId,
        prompt: task?.prompt || '',
        size: task?.size || '1:1',
        resolution: task?.resolution || '1k',
        imageUrl: '',
        createdAt: Date.now(),
        tags: [],
        favorited: false,
        error: errorMsg,
      });
      console.warn(`[task ${taskId}] 失败:`, errorMsg);
    };

    const handleTimeout = () => {
      const msg = '生成超时（3分钟），请重试';
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId
            ? { ...t, status: 'failed', error: msg, progress: 0 }
            : t
        )
      );
      persistFailedToHistory(msg);
    };

    const cleanupAndUpdateGenerating = (interval: ReturnType<typeof setInterval>) => {
      clearInterval(interval);
      pollingRef.current.delete(taskId);
      setIsGenerating((prev) => {
        const stillRunning = [...(pollingRef.current.values())].length > 0;
        return stillRunning ? prev : false;
      });
    };

    const initialTimeout = setTimeout(() => {
      const interval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= MAX_POLLING_DURATION_MS) {
          handleTimeout();
          cleanupAndUpdateGenerating(interval);
          return;
        }

        try {
          const res = await authedFetch(`/api/task?task_id=${encodeURIComponent(taskId)}`, {
            headers: { 'x-apimart-key': userApiKey },
          });
          const data = await res.json();

          if (!data.success || data.error) {
            const msg = extractErrorMessage(data);
            setTasks((prev) =>
              prev.map((t) =>
                t.taskId === taskId
                  ? { ...t, status: 'failed', error: msg, progress: 0 }
                  : t
              )
            );
            persistFailedToHistory(msg);
            cleanupAndUpdateGenerating(interval);
            return;
          }

          const taskData = data.data;
          if (!taskData) return;

          const tData = Array.isArray(taskData) ? taskData[0] : taskData;
          if (!tData) return;

          const status = tData.status as TaskResult['status'];
          const progress = tData.progress ?? 0;
          const firstImage = tData.result?.images?.[0];
          const imageUrl =
            status === 'completed' && firstImage
              ? Array.isArray(firstImage.url)
                ? firstImage.url[0]
                : firstImage.url
              : undefined;

          setTasks((prev) =>
            prev.map((t) =>
              t.taskId === taskId
                ? {
                    ...t,
                    status,
                    progress,
                    imageUrl,
                    completedAt: status === 'completed' ? Date.now() : undefined,
                    error: status === 'failed' ? tData.error?.message || '生成失败' : undefined,
                  }
                : t
            )
          );

          if (status === 'completed') {
            cleanupAndUpdateGenerating(interval);
            if (imageUrl) {
              const task = tasks.find((t) => t.taskId === taskId);
              addToHistory({
                taskId,
                prompt: task?.prompt || '',
                size: task?.size || '1:1',
                resolution: task?.resolution || '1k',
                imageUrl,
                createdAt: Date.now(),
                tags: [],
                favorited: false,
              });
            }
          }

          if (status === 'failed') {
            const msg = tData.error?.message || '生成失败';
            persistFailedToHistory(msg);
            cleanupAndUpdateGenerating(interval);
          }
        } catch { /* network error, keep polling */ }
      }, 4000);
      pollingRef.current.set(taskId, interval);
    }, 12000);

    pollingRef.current.set(taskId, initialTimeout as unknown as ReturnType<typeof setInterval>);
    return () => {
      clearTimeout(initialTimeout);
      const ref = pollingRef.current.get(taskId);
      if (ref) { clearInterval(ref); pollingRef.current.delete(taskId); }
    };
  }, [tasks, addToHistory]);

  const handleGenerate = useCallback(async () => {
    if (!apiKey) { setApiKeyDialogOpen(true); return; }
    if (!prompt.trim()) return;
    setIsGenerating(true);

    const errorTaskId = `error-${Date.now()}`;
    const createFailedTask = (errorMsg: string): TaskResult => ({
      status: 'failed' as const,
      taskId: errorTaskId,
      prompt: prompt.trim(),
      size,
      resolution,
      createdAt: Date.now(),
      progress: 0,
      error: errorMsg,
    });

    const persistFailedTask = (errorMsg: string) => {
      addToHistory({
        taskId: errorTaskId,
        prompt: prompt.trim(),
        size,
        resolution,
        imageUrl: '',
        createdAt: Date.now(),
        tags: [],
        favorited: false,
        error: errorMsg,
      });
    };

    try {
      const payload: Record<string, unknown> = {
        prompt: prompt.trim(),
        n: 1,
        size,
        resolution,
      };
      if (referenceImages.length > 0) payload.image_urls = referenceImages;

      const res = await authedFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-apimart-key': apiKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success || data.error) {
        const msg = extractErrorMessage(data);
        setTasks((prev) => [createFailedTask(msg), ...prev]);
        persistFailedTask(msg);
        setIsGenerating(false);
        return;
      }

      // 新 apib.ai 接口：data.data 可能是数组（[{ status, task_id }]）或对象（{ status, task_id }）
      // 兼容两种格式
      const submitted = Array.isArray(data.data) ? data.data[0] : data.data;
      const taskId = submitted?.task_id;
      if (!taskId) {
        const msg = '提交成功但未获取到任务 ID（apib.ai 响应格式异常）';
        setTasks((prev) => [createFailedTask(msg), ...prev]);
        persistFailedTask(msg);
        setIsGenerating(false);
        return;
      }

      const newTask: TaskResult = {
        status: 'submitted',
        taskId,
        prompt: prompt.trim(),
        size,
        resolution,
        createdAt: Date.now(),
        progress: 0,
      };
      setTasks((prev) => [newTask, ...prev]);
      pollTaskStatus(taskId, apiKey);
    } catch (e) {
      const msg = e instanceof Error ? `网络请求失败：${e.message}` : '网络请求失败，请检查浏览器网络';
      setTasks((prev) => [createFailedTask(msg), ...prev]);
      persistFailedTask(msg);
      setIsGenerating(false);
    }
  }, [apiKey, prompt, size, resolution, referenceImages, pollTaskStatus, addToHistory]);

  const handleDownload = useCallback(async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  const handleCopyImage = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopiedImageUrl(url);
      setTimeout(() => setCopiedImageUrl(null), 1500);
    } catch { /* ignore */ }
  }, []);

  const handleCopyLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 1500);
    } catch { /* ignore */ }
  }, []);

  const handleCopyTaskId = useCallback(async (taskId: string) => {
    try {
      await navigator.clipboard.writeText(taskId);
      setCopiedTaskId(taskId);
      setTimeout(() => setCopiedTaskId(null), 1500);
    } catch { /* ignore */ }
  }, []);

  const getStatusBadge = (status: TaskResult['status']) => {
    const map = {
      submitted: { text: '已提交', cls: 'border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:bg-blue-950' },
      processing: { text: '生成中', cls: 'border-amber-200 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950' },
      completed: { text: '已完成', cls: 'border-emerald-200 text-emerald-600 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950' },
      failed: { text: '失败', cls: 'border-red-200 text-red-500 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950' },
    };
    const { text, cls } = map[status];
    return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${cls}`}>
        {text}
      </Badge>
    );
  };

  const handleClearTasks = useCallback(() => {
    pollingRef.current.forEach((ref) => clearInterval(ref));
    pollingRef.current.clear();
    setTasks([]);
    setIsGenerating(false);
  }, []);

  const handleLogout = useCallback(async () => {
    try { await fetch(withBase('/api/auth/logout'), { method: 'POST' }); } catch { /* ignore */ }
    onLogout();
  }, [onLogout]);

  const hasActiveTasks = tasks.some((t) => t.status === 'submitted' || t.status === 'processing');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const activeTasks = tasks.filter((t) => t.status === 'submitted' || t.status === 'processing');
  const failedTasks = tasks.filter((t) => t.status === 'failed');

  // Build a quick lookup of history items by taskId (for tags/favorites)
  const historyByTaskId = useMemo(() => {
    const map = new Map<string, HistoryItem>();
    for (const h of history) map.set(h.taskId, h);
    return map;
  }, [history]);

  // All unique tags across all history items
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) for (const t of h.tags) set.add(t);
    return Array.from(set).sort();
  }, [history]);

  // Apply gallery filter (favorites + tag) to completed tasks
  const filteredTasks = useMemo(() => {
    return completedTasks.filter((task) => {
      const hist = historyByTaskId.get(task.taskId);
      if (galleryFilter === 'favorites' && !(hist?.favorited)) return false;
      if (galleryTagFilter && !(hist?.tags ?? []).includes(galleryTagFilter)) return false;
      return true;
    });
  }, [completedTasks, historyByTaskId, galleryFilter, galleryTagFilter]);

  const isFiltering = galleryFilter !== 'all' || galleryTagFilter !== null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/60">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-5 lg:px-8 h-12 sm:h-14 flex items-center justify-between">
            {/* Left: Logo + Brand */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl overflow-hidden shadow-sm ring-1 ring-primary/10">
                <img src={withBase("/logo.png")} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <h1 className="text-[13px] sm:text-[15px] font-semibold tracking-tight text-foreground">GPT Image Studio</h1>
                <span className="hidden sm:inline text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
                  GPT-Image-2
                </span>
              </div>
            </div>

            {/* Right: Desktop Controls */}
            <div className="hidden lg:flex items-center gap-2">
              {apiKey ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  <span>已连接</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-primary/60">
                  <AlertCircle className="w-3 h-3" />
                  <span>未配置</span>
                </div>
              )}

              {/* Templates Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplatesOpen(true)}
                className="h-7 gap-1.5 text-xs rounded-lg border-border/60 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-colors"
              >
                <Library className="w-3 h-3" />
                <span>模板</span>
                {templates.length > 0 && (
                  <span className="text-[9px] bg-primary/15 text-primary px-1 rounded-full font-medium">{templates.length}</span>
                )}
              </Button>

              {/* History Button */}
              <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs rounded-lg border-border/60 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-colors"
                  >
                    <History className="w-3 h-3" />
                    <span>历史</span>
                    {history.length > 0 && (
                      <span className="text-[9px] bg-primary/15 text-primary px-1 rounded-full font-medium">{history.length}</span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <History className="w-4 h-4 text-primary" />
                      生成历史
                    </DialogTitle>
                    <DialogDescription className="sr-only">查看和管理工作历史记录</DialogDescription>
                  </DialogHeader>
                  <div className="overflow-y-auto max-h-[55vh] -mx-1 px-1">
                    {history.length === 0 ? (
                      <div className="flex flex-col items-center py-12 text-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/20 mb-3" />
                        <p className="text-[13px] text-muted-foreground/50">暂无生成记录</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-end">
                          <button
                            onClick={clearHistory}
                            className="text-[11px] text-muted-foreground/40 hover:text-red-500 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            清空全部
                          </button>
                        </div>
                        {history.map((item) => {
                            const sizeLabel = SIZE_OPTIONS.find((s) => s.value === item.size)?.label || item.size;
                            const resLabel = RESOLUTION_OPTIONS.find((r) => r.value === item.resolution)?.label || item.resolution;
                            return (
                              <div
                                key={item.taskId}
                                className="flex gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-border/60 transition-all duration-200 group"
                              >
                                <div
                                  className={cn(
                                    "relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg shrink-0 ring-1 ring-border/20 overflow-hidden",
                                    item.imageUrl ? "cursor-zoom-in" : "bg-muted/50 flex items-center justify-center"
                                  )}
                                  onClick={() => item.imageUrl && setLightboxImage(item.imageUrl)}
                                >
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="flex flex-col items-center text-[10px] text-muted-foreground/40">
                                      <AlertCircle className="w-4 h-4 mb-0.5" />
                                      <span className="max-w-full text-center truncate">生成失败</span>
                                    </div>
                                  )}
                                  {item.favorited && (
                                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500/90 flex items-center justify-center">
                                      <Star className="w-3 h-3 text-white fill-current" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <p className="text-[13px] text-foreground/80 line-clamp-2 leading-relaxed">{item.prompt}</p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-primary/5 text-primary/80 border border-primary/10">
                                      <AspectPreview ratio={item.size} />
                                      {sizeLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-muted/50 text-muted-foreground/70">
                                      {resLabel}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/40">
                                      {formatTime(item.createdAt)}
                                    </span>
                                  </div>
                                  {item.error && (
                                    <p className="text-[11px] text-red-500/70 line-clamp-1">{item.error}</p>
                                  )}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => toggleFavorite(item.taskId)}
                                      className={`h-6 px-2 rounded text-[10px] gap-1 flex items-center transition-all ${
                                        item.favorited
                                          ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                                          : 'text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10'
                                      }`}
                                      title={item.favorited ? '取消收藏' : '收藏'}
                                    >
                                      <Star className={`w-3 h-3 ${item.favorited ? 'fill-current' : ''}`} />
                                      {item.favorited ? '已收藏' : '收藏'}
                                    </button>
                                    {item.imageUrl && (
                                      <>
                                        <button
                                          onClick={() => handleCopyImage(item.imageUrl)}
                                          className="h-6 px-2 rounded text-[10px] gap-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 flex items-center transition-all"
                                          title="复制图片"
                                        >
                                          {copiedImageUrl === item.imageUrl ? (
                                            <><CopyCheck className="w-3 h-3 text-emerald-500" /> 已复制</>
                                          ) : (
                                            <><Copy className="w-3 h-3" /> 复制图片</>
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleCopyLink(item.imageUrl)}
                                          className="h-6 px-2 rounded text-[10px] gap-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 flex items-center transition-all"
                                          title="复制链接"
                                        >
                                          {copiedLink === item.imageUrl ? (
                                            <><CopyCheck className="w-3 h-3 text-emerald-500" /> 已复制</>
                                          ) : (
                                            <><ExternalLink className="w-3 h-3" /> 复制链接</>
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleDownload(item.imageUrl, `gpt-image-${item.taskId}.png`)}
                                          className="h-6 px-2 rounded text-[10px] gap-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 flex items-center transition-all"
                                          title="下载图片"
                                        >
                                          <Download className="w-3 h-3" /> 下载
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => deleteHistoryItem(item.taskId)}
                                      className="h-6 px-2 rounded text-[10px] gap-1 text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center transition-all"
                                      title="删除"
                                    >
                                      <Trash2 className="w-3 h-3" /> 删除
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Templates Library Dialog */}
              <Dialog open={templatesOpen} onOpenChange={(o) => { setTemplatesOpen(o); if (!o) { setTemplateSearch(''); setTemplateCategory('全部'); } }}>
                <DialogContent className="sm:max-w-[680px] max-h-[85vh] p-0 gap-0">
                  <DialogHeader className="p-5 pb-3">
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <Library className="w-4 h-4 text-primary" />
                      提示词模板库
                    </DialogTitle>
                    <DialogDescription className="sr-only">管理和使用你的提示词模板</DialogDescription>
                  </DialogHeader>

                  {/* Search and filter bar */}
                  <div className="px-5 pb-3 space-y-2.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                      <Input
                        placeholder="搜索模板标题、内容、标签..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="h-8 pl-8 text-[13px] bg-muted/40 border-border/40"
                      />
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                      {TEMPLATE_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setTemplateCategory(cat)}
                          className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            templateCategory === cat
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                      <div className="ml-auto text-[10px] text-muted-foreground/40 shrink-0">
                        共 {filteredTemplates.length} 个
                      </div>
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-[55vh] border-t border-border/30">
                    {filteredTemplates.length === 0 ? (
                      <div className="flex flex-col items-center py-14 text-center">
                        <Library className="w-10 h-10 text-muted-foreground/20 mb-3" />
                        <p className="text-[13px] text-muted-foreground/50">
                          {templates.length === 0 ? '暂无模板' : '没有匹配的模板'}
                        </p>
                        {templates.length === 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setTemplatesOpen(false); openSaveTemplate(); }}
                            className="mt-3 h-8 text-xs"
                          >
                            <BookmarkPlus className="w-3 h-3 mr-1" />创建第一个模板
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {filteredTemplates.map((tpl) => (
                          <div
                            key={tpl.id}
                            className="group p-3.5 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                  <Library className="w-3 h-3 text-primary" />
                                </div>
                                <h3 className="text-[13px] font-medium truncate">{tpl.title}</h3>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                  {tpl.category}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={() => openEditTemplate(tpl)}
                                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all"
                                  title="编辑"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`确定删除模板"${tpl.title}"？`)) {
                                      handleDeleteTemplate(tpl.id);
                                    }
                                  }}
                                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                                  title="删除"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                              {tpl.content}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {tpl.tags.length > 0 && tpl.tags.slice(0, 4).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/70"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => insertTemplate(tpl, 'replace')}
                                  className="h-6 px-2 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                  title="替换当前内容"
                                >
                                  替换
                                </button>
                                <button
                                  onClick={() => insertTemplate(tpl, 'append')}
                                  className="h-6 px-2.5 rounded text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 transition-all"
                                  title="追加到当前内容末尾"
                                >
                                  <Check className="w-3 h-3" />插入
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer with create button */}
                  <div className="p-3 border-t border-border/30 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setTemplatesOpen(false); openSaveTemplate(); }}
                      className="h-8 text-xs"
                    >
                      <BookmarkPlus className="w-3 h-3 mr-1" />新建模板
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Save/Edit Template Dialog */}
              <Dialog open={saveTemplateOpen} onOpenChange={(o) => { setSaveTemplateOpen(o); if (!o) setEditingTemplate(null); }}>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      {editingTemplate ? <Edit3 className="w-4 h-4 text-primary" /> : <BookmarkPlus className="w-4 h-4 text-primary" />}
                      {editingTemplate ? '编辑模板' : '保存为模板'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">{editingTemplate ? '修改模板内容' : '将当前描述保存为可复用的模板'}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-1">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">标题 <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="如：电商主图、人物肖像..."
                        value={templateForm.title}
                        onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                        className="h-8 text-[13px]"
                        maxLength={50}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">分类</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {TEMPLATE_CATEGORIES.filter((c) => c !== '全部').map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setTemplateForm({ ...templateForm, category: cat })}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                              templateForm.category === cat
                                ? 'bg-primary/10 text-primary border border-primary/30'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">提示词内容 <span className="text-red-500">*</span></Label>
                      <Textarea
                        placeholder="可使用 {变量名} 占位符，方便后续替换..."
                        value={templateForm.content}
                        onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                        className="min-h-[100px] text-[12px] font-mono resize-none bg-muted/50 border-border/40"
                        maxLength={2000}
                      />
                      <div className="text-[10px] text-muted-foreground/40 text-right">
                        {templateForm.content.length} / 2000
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">标签（逗号分隔，最多 8 个）</Label>
                      <Input
                        placeholder="如：电商, 白底, 产品"
                        value={templateForm.tagsInput}
                        onChange={(e) => setTemplateForm({ ...templateForm, tagsInput: e.target.value })}
                        className="h-8 text-[13px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSaveTemplateOpen(false); setEditingTemplate(null); }}
                      className="h-8 text-xs"
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveTemplate}
                      className="h-8 text-xs bg-primary hover:bg-primary/90"
                    >
                      {editingTemplate ? '保存修改' : '保存模板'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Toast */}
              {toast && (
                <div
                  className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-[13px] font-medium shadow-lg border transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
                    toast.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/90 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                  }`}
                >
                  {toast.message}
                </div>
              )}

              {/* Preferences Button */}
              <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs rounded-lg border-border/60 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-colors"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>偏好</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <SlidersHorizontal className="w-4 h-4 text-primary" />
                      偏好设置
                    </DialogTitle>
                    <DialogDescription className="sr-only">自定义主题与界面尺寸</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-2">
                    {/* Theme */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-primary/70" /> : <Sun className="w-3.5 h-3.5 text-primary/70" />}
                        <Label className="text-sm font-medium">主题</Label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setTheme('light')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                            theme === 'light'
                              ? 'bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/10'
                              : 'bg-muted/50 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60'
                          }`}
                        >
                          <Sun className="w-4 h-4" />浅色
                        </button>
                        <button
                          onClick={() => setTheme('dark')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                            theme === 'dark'
                              ? 'bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/10'
                              : 'bg-muted/50 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60'
                          }`}
                        >
                          <Moon className="w-4 h-4" />深色
                        </button>
                      </div>
                    </div>
                    <Separator className="bg-border/30" />
                    {/* UI Size */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Maximize2 className="w-3.5 h-3.5 text-primary/70" />
                        <Label className="text-sm font-medium">界面尺寸</Label>
                      </div>
                      <div className="flex gap-2">
                        {([
                          { value: 'compact' as UiSize, label: '紧凑', icon: Minimize2 },
                          { value: 'default' as UiSize, label: '默认', icon: Monitor },
                          { value: 'comfortable' as UiSize, label: '舒适', icon: Maximize2 },
                        ]).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setUiSize(opt.value)}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                              uiSize === opt.value
                                ? 'bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/10'
                                : 'bg-muted/50 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60'
                            }`}
                          >
                            <opt.icon className="w-4 h-4" />
                            <span className="text-[11px]">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 leading-relaxed">调整整体界面文字与间距大小，设置即时生效。</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* API Key Button */}
              <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs rounded-lg border-border/60 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-colors"
                  >
                    <Key className="w-3 h-3" />
                    <span>API Key</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <Key className="w-4 h-4 text-primary" />配置 API Key
                    </DialogTitle>
                    <DialogDescription className="sr-only">输入您的 API Key 以使用图片生成服务</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-1">
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      前往{' '}
                      <a href="https://apib.ai/keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:text-primary/80 transition-colors">
                        apib.ai/keys <ExternalLink className="w-2.5 h-2.5" />
                      </a>{' '}
                      获取密钥，密钥仅存储于浏览器本地。
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="apiKey" className="text-xs text-muted-foreground">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="sk-..."
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveApiKey(); }}
                        className="h-9"
                      />
                    </div>
                    <Button
                      onClick={handleSaveApiKey}
                      className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-lg transition-colors"
                      disabled={!apiKeyInput.trim()}
                    >
                      {apiKeySaved ? <><Check className="w-3.5 h-3.5 mr-1" /> 已保存</> : '保存密钥'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <HistorySyncIndicator
                status={syncStatus}
                isAuthenticated={!!user}
                onFlush={flushNow}
              />

              {/* User + Logout */}
              <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-border/40">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                  <span className="max-w-[80px] truncate">{user?.displayName || '未登录'}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200"
                  title="退出登录"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right: Mobile Menu */}
            <MobileHeaderMenu
              user={user}
              apiKey={apiKey}
              onOpenApiKey={() => setApiKeyDialogOpen(true)}
              onOpenHistory={() => setHistoryOpen(true)}
              onOpenTemplates={() => setTemplatesOpen(true)}
              onOpenPrefs={() => setPrefsOpen(true)}
              onLogout={handleLogout}
              historyCount={history.length}
              templatesCount={templates.length}
            />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-5 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* ============ Left Panel ============ */}
            <div className="w-full lg:w-[360px] shrink-0 space-y-3 sm:space-y-4">
              {/* Prompt Card */}
              <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                      <Wand2 className="w-3 h-3 text-primary" />
                    </div>
                    <Label className="text-[13px] font-medium">描述你的画面</Label>
                  </div>
                  {/* Edit/Preview Toggle */}
                  <div className="flex items-center rounded-lg border border-border/40 bg-muted/30 p-0.5">
                    <button
                      onClick={() => setPromptMode('edit')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                        promptMode === 'edit'
                          ? 'bg-card text-primary shadow-sm border border-primary/20'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <PenLine className="w-3 h-3" />编辑
                    </button>
                    <button
                      onClick={() => setPromptMode('preview')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                        promptMode === 'preview'
                          ? 'bg-card text-primary shadow-sm border border-primary/20'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Eye className="w-3 h-3" />预览
                    </button>
                  </div>
                </div>

                {/* Quick template actions */}
                <div className="flex items-center gap-1.5 -mt-1.5">
                  <button
                    onClick={() => setTemplatesOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                    title="打开我的提示词模板库"
                  >
                    <Library className="w-3 h-3" />模板库
                  </button>
                  <button
                    onClick={() => openSaveTemplate()}
                    disabled={!prompt.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    title="将当前描述保存为模板"
                  >
                    <BookmarkPlus className="w-3 h-3" />保存为模板
                  </button>
                </div>

                {promptMode === 'edit' ? (
                  <Textarea
                    placeholder="描述你想要的画面，越详细效果越好...&#10;&#10;支持 Markdown 格式，可使用：&#10;**粗体** *斜体* `代码` - 列表等"
                    className="min-h-[120px] sm:min-h-[140px] resize-none bg-muted/50 border-border/40 focus:border-primary/40 text-[13px] leading-relaxed placeholder:text-muted-foreground/50 font-mono"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                ) : (
                  <div className="min-h-[120px] sm:min-h-[140px] rounded-xl bg-muted/30 border border-border/30 p-3.5 overflow-y-auto prompt-preview">
                    {prompt.trim() ? (
                      <ReactMarkdown>{prompt}</ReactMarkdown>
                    ) : (
                      <p className="text-[13px] text-muted-foreground/30 italic">暂无内容，请先在编辑模式输入描述...</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">灵感</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_PRESETS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => { setPrompt(p.prompt); setPromptMode('edit'); }}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 border border-transparent hover:border-primary/20"
                      >
                        {p.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Params Card - Collapsible on mobile */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 sm:p-5 lg:cursor-default"
                  onClick={() => setParamsExpanded(!paramsExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                      <Settings2 className="w-3 h-3 text-primary" />
                    </div>
                    <Label className="text-[13px] font-medium">参数</Label>
                    {/* Quick summary on mobile */}
                    <span className="lg:hidden text-[11px] text-muted-foreground/50 font-mono">
                      {size} · {resolution.toUpperCase()}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground/40 lg:hidden transition-transform duration-200 ${paramsExpanded ? 'rotate-180' : ''}`} />
                </button>

                <div className={`px-4 sm:px-5 pb-4 sm:pb-5 space-y-4 sm:space-y-5 transition-all duration-300 ${paramsExpanded ? 'block' : 'hidden lg:block'}`}>
                  {/* Size */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Ratio className="w-3 h-3 text-muted-foreground/50" />
                      <Label className="text-xs text-muted-foreground">比例</Label>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5">
                      {SIZE_OPTIONS.map((opt) => (
                        <Tooltip key={opt.value}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setSize(opt.value)}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border ${
                                size === opt.value
                                  ? 'bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/10'
                                  : 'bg-muted/50 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60 hover:bg-muted/80'
                              }`}
                            >
                              <AspectPreview ratio={opt.value} />
                              <span className="font-mono">{opt.value}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-[11px]">
                            {opt.value === 'auto' ? '自动选择' : `${opt.category === 'landscape' ? '横图' : opt.category === 'portrait' ? '竖图' : '正方'}`}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>

                  {/* Resolution */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Monitor className="w-3 h-3 text-muted-foreground/50" />
                      <Label className="text-xs text-muted-foreground">分辨率</Label>
                    </div>
                    <div className="flex gap-1.5">
                      {RESOLUTION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setResolution(opt.value)}
                          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                            resolution === opt.value
                              ? 'bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/10'
                              : 'bg-muted/50 border-border/30 text-muted-foreground/70 hover:text-foreground hover:border-border/60'
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className={`block text-[10px] font-normal mt-0.5 ${resolution === opt.value ? 'text-primary/60' : 'text-muted-foreground/50'}`}>
                            {opt.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-border/30" />

                  {/* Reference Images */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">参考图</Label>
                      {referenceImages.length > 0 && (
                        <button
                          onClick={() => { setReferenceImages([]); setReferenceFileNames([]); }}
                          className="text-[10px] text-muted-foreground/50 hover:text-red-500 flex items-center gap-0.5 transition-colors"
                        >
                          <Trash2 className="w-2.5 h-2.5" />清空
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {referenceImages.map((img, i) => (
                        <div key={i} className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden ring-1 ring-border/30 group">
                          <img src={img} alt={referenceFileNames[i] || '参考图'} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemoveRefImage(i)}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ))}
                      {referenceImages.length < 16 && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-dashed border-border/40 flex flex-col items-center justify-center gap-0.5 text-muted-foreground/40 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                        >
                          <Upload className="w-4 h-4" />
                          <span className="text-[7px] sm:text-[8px] uppercase tracking-wider">Upload</span>
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !apiKey || !prompt.trim()}
                className={`w-full h-11 sm:h-12 rounded-xl text-sm font-semibold gap-2 transition-all duration-300 flex items-center justify-center ${
                  isGenerating
                    ? 'bg-primary/10 text-primary animate-glow-pulse border border-primary/20'
                    : apiKey && prompt.trim()
                      ? 'bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-400 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]'
                      : 'bg-muted text-muted-foreground/40 cursor-not-allowed border border-border/30'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中
                    <span className="flex gap-0.5 ml-0.5">
                      <span className="w-0.5 h-0.5 rounded-full bg-current dot-pulse-1" />
                      <span className="w-0.5 h-0.5 rounded-full bg-current dot-pulse-2" />
                      <span className="w-0.5 h-0.5 rounded-full bg-current dot-pulse-3" />
                    </span>
                  </>
                ) : (
                  <><Sparkles className="w-4 h-4" />生成图片</>
                )}
              </button>
              {!apiKey && <p className="text-[11px] text-center text-muted-foreground/50">请先配置 API Key 以开始使用</p>}
            </div>

            {/* ============ Right Panel ============ */}
            <div className="flex-1 min-w-0 space-y-4 sm:space-y-5">
              {/* Active Tasks */}
              {activeTasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">进行中</h2>
                  </div>
                  <div className="space-y-2">
                    {activeTasks.map((task) => (
                      <div key={task.taskId} className="rounded-2xl border border-primary/15 bg-primary/5 p-3.5 sm:p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[13px] text-foreground/70 truncate flex-1">{task.prompt}</p>
                          {getStatusBadge(task.status)}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-primary/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-700 ease-out animate-shimmer"
                              style={{ width: `${Math.max(task.progress || 8, 8)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground/60 w-7 text-right font-mono">{task.progress || 0}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground/40 font-mono truncate">{task.taskId}</span>
                          <button
                            onClick={() => handleCopyTaskId(task.taskId)}
                            className="shrink-0 text-muted-foreground/30 hover:text-primary transition-colors"
                          >
                            {copiedTaskId === task.taskId ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Gallery */}
              {completedTasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">作品</h2>
                      <span className="text-[10px] text-muted-foreground/50">
                        {isFiltering ? `(${filteredTasks.length}/${completedTasks.length})` : `(${completedTasks.length})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* All / Favorites filter */}
                      <div className="inline-flex rounded-lg border border-border/50 bg-card/60 p-0.5">
                        <button
                          onClick={() => setGalleryFilter('all')}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                            galleryFilter === 'all'
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <LayoutGrid className="w-3 h-3" />
                          全部
                        </button>
                        <button
                          onClick={() => setGalleryFilter('favorites')}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                            galleryFilter === 'favorites'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Star className="w-3 h-3" />
                          收藏
                        </button>
                      </div>
                      {/* Tag filter dropdown */}
                      {allTags.length > 0 && (
                        <Select
                          value={galleryTagFilter ?? '__all__'}
                          onValueChange={(v) => setGalleryTagFilter(v === '__all__' ? null : v)}
                        >
                          <SelectTrigger className="h-7 w-auto min-w-[90px] text-[10px] gap-1 px-2 border-border/50 bg-card/60">
                            <Tag className="w-3 h-3" />
                            <SelectValue placeholder="标签" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">所有标签</SelectItem>
                            {allTags.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isFiltering && (
                        <button
                          onClick={() => {
                            setGalleryFilter('all');
                            setGalleryTagFilter(null);
                          }}
                          className="h-7 px-2 inline-flex items-center gap-0.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <X className="w-3 h-3" />
                          清除
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-8 text-center">
                      <p className="text-xs text-muted-foreground">
                        {galleryFilter === 'favorites' ? '暂无收藏的作品' : `暂无标签为「${galleryTagFilter}」的作品`}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {filteredTasks.map((task) => {
                        const hist = historyByTaskId.get(task.taskId);
                        const isFavorited = hist?.favorited ?? false;
                        const taskTags = hist?.tags ?? [];
                        return (
                          <div
                            key={task.taskId}
                            className="group rounded-2xl border border-border/40 bg-card overflow-hidden animate-fade-in-up hover:border-primary/30 hover:shadow-md transition-all duration-300 shadow-sm"
                          >
                            <div
                              className="relative cursor-zoom-in overflow-hidden"
                              onClick={() => task.imageUrl && setLightboxImage(task.imageUrl)}
                            >
                              {task.imageUrl && (
                                <img src={task.imageUrl} alt={task.prompt} className="w-full object-contain max-h-[280px] sm:max-h-[360px] xl:max-h-[420px] bg-muted/30 transition-transform duration-500 group-hover:scale-[1.02]" />
                              )}
                              {/* Top-left action bar: star + tag editor */}
                              <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(task.taskId);
                                  }}
                                  className={`h-7 w-7 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-200 ${
                                    isFavorited
                                      ? 'bg-amber-500/90 text-white hover:bg-amber-500'
                                      : 'bg-black/30 text-white/80 hover:bg-black/50 hover:text-white'
                                  }`}
                                  title={isFavorited ? '取消收藏' : '收藏'}
                                >
                                  <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current' : ''}`} />
                                </button>
                                <TagEditPopover
                                  tags={taskTags}
                                  suggestions={allTags}
                                  onAdd={(tag) => addTag(task.taskId, tag)}
                                  onRemove={(tag) => removeTag(task.taskId, tag)}
                                />
                              </div>
                              {/* Hover zoom hint */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <ZoomIn className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="p-3 sm:p-3.5 space-y-2">
                              <p className="text-[12px] text-foreground/60 line-clamp-2 leading-relaxed">{task.prompt}</p>
                              {/* Tags */}
                              {taskTags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {taskTags.slice(0, 4).map((t) => (
                                    <button
                                      key={t}
                                      onClick={() => setGalleryTagFilter(t)}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                    >
                                      <Tag className="w-2.5 h-2.5" />
                                      {t}
                                    </button>
                                  ))}
                                  {taskTags.length > 4 && (
                                    <span className="text-[9px] text-muted-foreground/50">+{taskTags.length - 4}</span>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(task.status)}
                                  <span className="text-[10px] text-muted-foreground/50 font-mono">{task.size} · {task.resolution.toUpperCase()}</span>
                                </div>
                                {task.imageUrl && (
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      className="h-6 px-1.5 rounded-md text-[10px] gap-0.5 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 flex items-center transition-all duration-200"
                                      onClick={() => handleCopyImage(task.imageUrl!)}
                                      title="复制图片"
                                    >
                                      {copiedImageUrl === task.imageUrl ? <CopyCheck className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                    <button
                                      className="h-6 px-1.5 rounded-md text-[10px] gap-0.5 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 flex items-center transition-all duration-200"
                                      onClick={() => handleCopyLink(task.imageUrl!)}
                                      title="复制链接"
                                    >
                                      {copiedLink === task.imageUrl ? <CopyCheck className="w-3 h-3 text-emerald-500" /> : <ExternalLink className="w-3 h-3" />}
                                    </button>
                                    <button
                                      className="h-6 px-1.5 rounded-md text-[10px] gap-0.5 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 flex items-center transition-all duration-200"
                                      onClick={() => handleDownload(task.imageUrl!, `gpt-image-${task.taskId}.png`)}
                                      title="下载图片"
                                    >
                                      <Download className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Failed Tasks */}
              {failedTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">错误</h2>
                  </div>
                  {failedTasks.map((task) => (
                    <div key={task.taskId} className="rounded-2xl border border-destructive/15 bg-destructive/5 p-3.5">
                      <p className="text-[12px] text-foreground/50 truncate">{task.prompt}</p>
                      <p className="text-[11px] text-destructive mt-1">{task.error}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
                  <div className="relative mb-6 sm:mb-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                      <ImageIcon className="w-7 h-7 sm:w-8 sm:h-8 text-primary/30" />
                    </div>
                    <div className="absolute -right-1 -top-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-2 sm:w-2.5 h-2 sm:h-2.5 text-primary/40" />
                    </div>
                  </div>
                  <h3 className="text-sm sm:text-base font-medium text-foreground/50 mb-2">开始创作</h3>
                  <p className="text-[12px] sm:text-[13px] text-muted-foreground/50 max-w-[260px] leading-relaxed">
                    输入描述，选择比例与分辨率，<br />点击生成即可开始
                  </p>
                </div>
              )}

              {/* Clear */}
              {tasks.length > 0 && !hasActiveTasks && (
                <div className="flex justify-center pt-1">
                  <button
                    className="text-[11px] text-muted-foreground/40 hover:text-red-500 flex items-center gap-1 transition-colors py-1"
                    onClick={handleClearTasks}
                  >
                    <Trash2 className="w-3 h-3" />清空记录
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Lightbox */}
        {lightboxImage && (() => {
          const lightboxTask = completedTasks.find((t) => t.imageUrl === lightboxImage);
          const lightboxHist = lightboxTask
            ? historyByTaskId.get(lightboxTask.taskId)
            : history.find((h) => h.imageUrl === lightboxImage);
          const isLightboxFav = lightboxHist?.favorited ?? false;
          const lightboxTags = lightboxHist?.tags ?? [];
          return (
            <div
              className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 cursor-zoom-out animate-in fade-in duration-200"
              onClick={() => setLightboxImage(null)}
            >
              <img src={lightboxImage} alt="Preview" className="max-w-full max-h-[85vh] sm:max-h-full object-contain rounded-lg shadow-2xl" />
              <button
                className="absolute top-3 right-3 sm:top-5 sm:right-5 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all duration-200 ring-1 ring-white/10"
                onClick={() => setLightboxImage(null)}
              >
                <X className="w-4 h-4" />
              </button>
              {/* Top-left: star + tag editor for this image */}
              {lightboxTask && (
                <div className="absolute top-3 left-3 sm:top-5 sm:left-5 flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(lightboxTask.taskId);
                    }}
                    className={`h-8 sm:h-9 w-8 sm:w-9 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-200 ${
                      isLightboxFav
                        ? 'bg-amber-500/90 text-white hover:bg-amber-500'
                        : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                    }`}
                    title={isLightboxFav ? '取消收藏' : '收藏'}
                  >
                    <Star className={`w-4 h-4 ${isLightboxFav ? 'fill-current' : ''}`} />
                  </button>
                  <TagEditPopover
                    tags={lightboxTags}
                    suggestions={allTags}
                    onAdd={(tag) => addTag(lightboxTask.taskId, tag)}
                    onRemove={(tag) => removeTag(lightboxTask.taskId, tag)}
                  />
                </div>
              )}
              {/* Show tags chips below image */}
              {lightboxTags.length > 0 && (
                <div className="absolute top-14 left-3 sm:top-16 sm:left-5 flex items-center gap-1 flex-wrap max-w-[60vw]">
                  {lightboxTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] bg-white/15 backdrop-blur-sm text-white/90"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 flex items-center gap-2">
                <button
                  className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-white/60 hover:text-white text-[11px] sm:text-xs transition-all duration-200 ring-1 ring-white/10"
                  onClick={(e) => { e.stopPropagation(); handleCopyImage(lightboxImage); }}
                >
                  {copiedImageUrl === lightboxImage ? <CopyCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedImageUrl === lightboxImage ? '已复制' : '复制图片'}
                </button>
                <button
                  className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-white/60 hover:text-white text-[11px] sm:text-xs transition-all duration-200 ring-1 ring-white/10"
                  onClick={(e) => { e.stopPropagation(); handleCopyLink(lightboxImage); }}
                >
                  {copiedLink === lightboxImage ? <CopyCheck className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  {copiedLink === lightboxImage ? '已复制' : '复制链接'}
                </button>
                <button
                  className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-white/60 hover:text-white text-[11px] sm:text-xs transition-all duration-200 ring-1 ring-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    const task = completedTasks.find((t) => t.imageUrl === lightboxImage);
                    const histItem = history.find((h) => h.imageUrl === lightboxImage);
                    if (lightboxImage) handleDownload(lightboxImage, `gpt-image-${task?.taskId || histItem?.taskId || 'image'}.png`);
                  }}
                >
                  <Download className="w-3.5 h-3.5" />下载
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </TooltipProvider>
  );
}

// ---- Root Component ----
export default function Home() {
  const { user, authChecked, login, logout } = useAuth();

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  return <MainApp user={user} onLogout={logout} />;
}
