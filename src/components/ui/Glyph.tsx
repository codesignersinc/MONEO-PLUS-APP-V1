import type { CSSProperties } from 'react';
import {
  AlarmClock,
  Apple,
  Ban,
  Landmark,
  Banknote,
  BarChart3,
  Bell,
  Bird,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Brush,
  CalendarDays,
  Camera,
  Car,
  CarTaxiFront,
  Castle,
  Check,
  ClipboardList,
  Clock,
  Cloud,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dices,
  Download,
  Drama,
  Folder,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Guitar,
  Hand,
  Handshake,
  Headphones,
  Heart,
  Home,
  Hourglass,
  Image,
  Inbox,
  Joystick,
  Laptop,
  LifeBuoy,
  Lightbulb,
  Link,
  Lock,
  MessageCircle,
  Mic,
  Music,
  NotebookPen,
  Package,
  Palette,
  PartyPopper,
  PenLine,
  Pencil,
  PersonStanding,
  PiggyBank,
  Play,
  Pill,
  Plane,
  Plus,
  Pointer,
  Receipt,
  RefreshCw,
  ArrowLeftRight,
  Sandwich,
  Satellite,
  Scissors,
  Search,
  Send,
  Settings,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Smile,
  Sofa,
  Sparkles,
  Sprout,
  Star,
  Store,
  Tag,
  Target,
  ToyBrick,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Tv,
  Upload,
  User,
  Users,
  Utensils,
  Video,
  Wallet,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { glyphKey, type GlyphKey } from '@/lib/glyphs';

// MONEO draws every icon as a thick-line glyph: no emojis anywhere (docs in src/lib/glyphs.ts).

export const GLYPHS: Record<GlyphKey, LucideIcon> = {
  alarm: AlarmClock,
  alert: TriangleAlert,
  apple: Apple,
  bag: ShoppingBag,
  ban: Ban,
  bank: Landmark,
  bell: Bell,
  bird: Bird,
  book: BookOpen,
  bot: Bot,
  brain: Brain,
  briefcase: Briefcase,
  brush: Brush,
  bulb: Lightbulb,
  calendar: CalendarDays,
  camera: Camera,
  car: Car,
  card: CreditCard,
  cart: ShoppingCart,
  cash: Banknote,
  castle: Castle,
  chain: Link,
  chart: BarChart3,
  chat: MessageCircle,
  check: Check,
  clipboard: ClipboardList,
  clock: Clock,
  close: X,
  cloud: Cloud,
  coffee: Coffee,
  coins: Coins,
  dice: Dices,
  download: Download,
  drama: Drama,
  edit: Pencil,
  exchange: ArrowLeftRight,
  film: Clapperboard,
  folder: Folder,
  food: Utensils,
  gamepad: Gamepad2,
  gem: Gem,
  gift: Gift,
  globe: Globe,
  graduation: GraduationCap,
  guitar: Guitar,
  hand: Hand,
  handshake: Handshake,
  headphones: Headphones,
  heart: Heart,
  home: Home,
  hourglass: Hourglass,
  image: Image,
  inbox: Inbox,
  joystick: Joystick,
  laptop: Laptop,
  lifebuoy: LifeBuoy,
  lock: Lock,
  mic: Mic,
  music: Music,
  note: NotebookPen,
  package: Package,
  palette: Palette,
  party: PartyPopper,
  pen: PenLine,
  person: PersonStanding,
  phone: Smartphone,
  piggy: PiggyBank,
  play: Play,
  pill: Pill,
  plane: Plane,
  plus: Plus,
  pointer: Pointer,
  receipt: Receipt,
  repeat: RefreshCw,
  sandwich: Sandwich,
  satellite: Satellite,
  scissors: Scissors,
  search: Search,
  send: Send,
  settings: Settings,
  shield: Shield,
  shirt: Shirt,
  smile: Smile,
  sofa: Sofa,
  sparkles: Sparkles,
  sprout: Sprout,
  star: Star,
  store: Store,
  tag: Tag,
  target: Target,
  taxi: CarTaxiFront,
  toy: ToyBrick,
  trending: TrendingUp,
  trophy: Trophy,
  tv: Tv,
  upload: Upload,
  user: User,
  users: Users,
  video: Video,
  wallet: Wallet,
  waves: Waves,
  zap: Zap,
};

/** Line weight of MONEO glyphs: thick, retro 2D. */
export const GLYPH_STROKE = 2.5;

/** The icon for a stored value (glyph key or legacy emoji); `fallback` when unknown. */
export function glyphIcon(value: string | null | undefined, fallback: GlyphKey = 'tag') {
  return GLYPHS[glyphKey(value) ?? fallback];
}

/**
 * A thick-line glyph. `name` is a glyph key or a stored legacy emoji; unknown values draw
 * `fallback`. Size it with className (default h-5 w-5).
 */
export default function Glyph({
  name,
  fallback = 'tag',
  className = 'h-5 w-5',
  strokeWidth = GLYPH_STROKE,
  style,
  label,
}: {
  name: string | null | undefined;
  fallback?: GlyphKey;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  /** Accessible name; omit for decorative icons next to a text label. */
  label?: string;
}) {
  const Icon = glyphIcon(name, fallback);
  return (
    <Icon
      className={className}
      strokeWidth={strokeWidth}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}

/**
 * Retro 2D tile around a glyph: thick border and a hard shadow. `color` is the tile fill.
 */
export function GlyphTile({
  name,
  fallback = 'tag',
  color = '#FFD83D',
  size = 'md',
  className = '',
  label,
}: {
  name: string | null | undefined;
  fallback?: GlyphKey;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}) {
  const box = {
    sm: 'h-8 w-8 rounded-lg border-2 shadow-[2px_2px_0_#111]',
    md: 'h-10 w-10 rounded-xl border-2 shadow-[2px_2px_0_#111]',
    lg: 'h-12 w-12 rounded-2xl border-[3px] shadow-[3px_3px_0_#111]',
  }[size];
  const icon = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }[size];
  return (
    <span
      className={`inline-grid shrink-0 place-items-center border-[#111] text-[#111] ${box} ${className}`}
      style={{ backgroundColor: color }}
    >
      <Glyph name={name} fallback={fallback} className={icon} label={label} />
    </span>
  );
}

/**
 * Country or currency marker without flag emojis: the ISO code in a small retro badge.
 */
export function CodeBadge({ code, className = '' }: { code: string; className?: string }) {
  return (
    <span
      className={`inline-flex min-w-[2.1em] items-center justify-center rounded-md border-2 border-[#111] bg-white px-1 font-mono text-[0.7em] font-black leading-[1.5] tracking-wide text-[#111] ${className}`}
    >
      {code}
    </span>
  );
}
