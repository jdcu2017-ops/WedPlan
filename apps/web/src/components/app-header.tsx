"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Universal header — usable on public pages (vendor browse/detail, landing)
// and authenticated ones alike, since it renders differently for a logged-in
// user vs. a visitor rather than assuming one or the other.
export function AppHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold">
            WedPlan
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-gray-600">
            <Link href="/vendors" className="hover:text-gray-900">
              Browse vendors
            </Link>
            {user && (
              <>
                <Link href="/dashboard" className="hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/profile" className="hover:text-gray-900">
                  Profile
                </Link>
                <Link href="/inquiries" className="hover:text-gray-900">
                  Inquiries
                </Link>
                <Link href="/bookings" className="hover:text-gray-900">
                  Bookings
                </Link>
              </>
            )}
            {user?.role === "inquirer" && (
              <Link href="/checklist" className="hover:text-gray-900">
                Checklist
              </Link>
            )}
            {user?.role === "vendor" && (
              <>
                <Link href="/vendor/packages" className="hover:text-gray-900">
                  My packages
                </Link>
                <Link href="/vendor/availability" className="hover:text-gray-900">
                  Availability
                </Link>
                <Link href="/vendor/payments-setup" className="hover:text-gray-900">
                  Payments setup
                </Link>
              </>
            )}
          </nav>
        </div>
        {loading ? null : user ? (
          <button
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
          >
            Log out
          </button>
        ) : (
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link href="/login" className="hover:text-gray-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-gray-900 px-3 py-1.5 text-white hover:bg-gray-700"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
