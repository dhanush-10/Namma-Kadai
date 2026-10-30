import { ShoppingBasket } from 'lucide-react';
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${light ? 'bg-white/15 text-white' : 'bg-brand-700 text-white'}`}><ShoppingBasket className="h-6 w-6" /></span>
    </span>
  );
}
