import Link from 'next/link';

/** Free vs Universal Premium. `current` hides the CTA for the member's own plan. */
export function PlanCards({ current }: { current?: 'FREE' | 'PREMIUM' }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-8">
      <div className="card flex flex-col gap-5 p-8 sm:p-10">
        <h3 className="text-xl font-bold">Free</h3>
        <p className="font-serif text-[56px] leading-none">₹0</p>
        <ul className="flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-normal text-ink-soft">
          <li>Create profile, browse and search</li>
          <li>1 contact unlock per week (4 a month)</li>
          <li>5 interests per day</li>
        </ul>
        {current === 'FREE' ? (
          <p className="mt-auto py-3.5 text-center font-bold text-ink-muted">Your current plan</p>
        ) : current ? null : (
          <Link href="/login?signup=1" className="btn-outline mt-auto py-3.5">
            Register free
          </Link>
        )}
      </div>
      <div className="frame-double flex flex-col gap-5 bg-maroon p-8 text-ivory sm:p-10">
        <h3 className="text-xl font-bold text-gold-light">Universal Premium</h3>
        <p className="font-serif text-[56px] leading-none">
          ₹150<span className="font-sans text-base text-blush"> / month + GST</span>
        </p>
        <ul className="flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-normal text-blush">
          <li>4 contact unlocks per week (16 a month)</li>
          <li>Unlimited interests</li>
          <li>See who viewed your profile</li>
          <li>See photos shared with Premium members</li>
          <li>Premium badge and higher visibility (coming soon)</li>
        </ul>
        <p className="text-xs text-blush">₹177 including 18% GST. Your unlock week starts on the day you pay.</p>
        {current === 'PREMIUM' ? (
          <p className="mt-auto py-3.5 text-center font-bold text-gold-light">Your current plan</p>
        ) : (
          <Link href={current ? '/checkout' : '/login?signup=1&next=/checkout'} className="btn-gold mt-auto py-3.5">
            Go Premium
          </Link>
        )}
      </div>
    </div>
  );
}
