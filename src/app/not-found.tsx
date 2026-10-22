import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="pixel text-[10px] text-signal">No signal</p>
      <h1 className="font-display text-[clamp(2rem,5vw,3.6rem)] italic">This channel is off the air.</h1>
      <Link href="/" className="btn btn-primary">
        Back to the packs
      </Link>
    </div>
  );
}
