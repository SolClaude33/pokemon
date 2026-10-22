import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="pixel text-signal">No signal</p>
      <h1 className="poke-title text-[clamp(2.2rem,5vw,3.8rem)]">This channel is off the air.</h1>
      <p className="gb-dialog max-w-sm">The wild page fled! Head back to the packs and try another channel.</p>
      <Link href="/" className="btn btn-primary">
        Back to the packs
      </Link>
    </div>
  );
}
