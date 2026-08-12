import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">WedPlan</h1>
      <p className="text-lg text-gray-600">
        Find, message, and book every wedding vendor in one place.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-md bg-gray-900 px-5 py-2.5 font-medium text-white hover:bg-gray-700"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-gray-300 px-5 py-2.5 font-medium hover:bg-gray-100"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
