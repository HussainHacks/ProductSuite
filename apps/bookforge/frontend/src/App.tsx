import React, { useCallback, useEffect, useState } from "react";
import { Bell, Briefcase, CalendarClock, CheckCircle2, Copy, Users } from "lucide-react";
import { AppHeader, AuthScreen, Badge, EmptyState, ThemeProvider } from "@productsuite/ui";
import type { AuthUser } from "@productsuite/ui";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8004";

interface ServiceItem {
  id: number;
  name: string;
  description: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  staff_ids: number[];
}

interface StaffItem {
  id: number;
  name: string;
  email: string;
  timezone: string;
  service_ids: number[];
}

interface AppointmentItem {
  id: number;
  service_name: string;
  staff_name: string;
  customer_name: string;
  customer_email: string;
  start_utc: string;
  end_utc: string;
  status: string;
}

interface NotificationItem {
  id: number;
  appointment_id: number;
  recipient_email: string;
  event_type: string;
  message: string;
  created_at: string;
}

interface SlotItem {
  start_utc: string;
  end_utc: string;
  display_local: string;
}

function PublicBookingView({ orgSlug }: { orgSlug: string }) {
  const [orgName, setOrgName] = useState("");
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staff, setStaff] = useState<{ id: number; name: string; timezone: string }[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerTz] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [confirmed, setConfirmed] = useState<AppointmentItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/booking/${orgSlug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Booking page not found."))))
      .then((data) => {
        setOrgName(data.organization_name);
        setServices(data.services);
        setStaff(data.staff);
        if (data.services[0]) setServiceId(data.services[0].id);
        if (data.staff[0]) setStaffId(data.staff[0].id);
      })
      .catch((e) => setError(e.message));
  }, [orgSlug]);

  useEffect(() => {
    if (!serviceId || !staffId || !targetDate) return;
    const params = new URLSearchParams({
      service_id: String(serviceId),
      staff_id: String(staffId),
      target_date: targetDate,
      customer_timezone: customerTz,
    });
    fetch(`${API_BASE}/api/public/booking/${orgSlug}/slots?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setSlots(data);
        setSelectedSlot(data[0]?.start_utc ?? "");
      });
  }, [orgSlug, serviceId, staffId, targetDate, customerTz]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!serviceId || !staffId || !selectedSlot) {
      setError("Please select a service, staff member, and available time slot.");
      return;
    }
    const res = await fetch(`${API_BASE}/api/public/booking/${orgSlug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        staff_id: staffId,
        start_utc: selectedSlot,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_timezone: customerTz,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Booking failed.");
      return;
    }
    setConfirmed(data);
  }

  if (confirmed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-12 w-12 text-violet-600" />
          <h2 className="mt-4 text-xl font-bold">Appointment Confirmed</h2>
          <p className="mt-2 text-sm text-slate-500">
            {confirmed.service_name} with {confirmed.staff_name}
          </p>
          <p className="mt-1 text-xs text-slate-400">{confirmed.start_utc}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleBook} className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="rounded-2xl border-t-4 border-t-violet-600 border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold">{orgName || "Book an Appointment"}</h1>
        <p className="mt-1 text-xs text-slate-500">Timezone: {customerTz}</p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Service</label>
          <select
            value={serviceId ?? ""}
            onChange={(e) => setServiceId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes}m)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Staff Member</label>
          <select
            value={staffId ?? ""}
            onChange={(e) => setStaffId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {staff.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Available Slots</label>
          <select
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {slots.length === 0 && <option value="">No slots available</option>}
            {slots.map((sl) => (
              <option key={sl.start_utc} value={sl.start_utc}>
                {sl.display_local}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Your full name"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <input
          type="email"
          required
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Your email"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Confirm Booking
        </button>
      </div>
    </form>
  );
}

function BookForgeWorkspace() {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem("bf_token"),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orgSlug, setOrgSlug] = useState("");
  const [tab, setTab] = useState<"appointments" | "services" | "staff" | "notifications">(
    "appointments",
  );
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [svcName, setSvcName] = useState("");
  const [svcDuration, setSvcDuration] = useState(30);
  const [svcBufferAfter, setSvcBufferAfter] = useState(10);

  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffTz, setStaffTz] = useState("America/Chicago");
  const [copied, setCopied] = useState(false);

  const publicSlug = new URLSearchParams(window.location.search).get("book");

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadAll = useCallback(async () => {
    if (!token) return;
    const [slugRes, svcRes, stRes, apptRes, notifRes] = await Promise.all([
      fetch(`${API_BASE}/api/org-slug`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/services`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/staff`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/appointments`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/notifications`, { headers: authHeaders() }),
    ]);
    if (slugRes.ok) setOrgSlug((await slugRes.json()).slug);
    if (svcRes.ok) setServices(await svcRes.json());
    if (stRes.ok) setStaff(await stRes.json());
    if (apptRes.ok) setAppointments(await apptRes.json());
    if (notifRes.ok) setNotifications(await notifRes.json());
  }, [token, authHeaders]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) {
          setUser(u);
          loadAll();
        } else {
          setToken(null);
        }
      });
  }, [token, authHeaders, loadAll]);

  if (publicSlug) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <AppHeader
          currentAppId="bookforge"
          appName="BookForge"
          accentClass="bg-violet-600"
          user={null}
        />
        <PublicBookingView orgSlug={publicSlug} />
      </div>
    );
  }

  if (!token || !user) {
    return (
      <>
        <AppHeader
          currentAppId="bookforge"
          appName="BookForge"
          accentClass="bg-violet-600"
          user={null}
        />
        <AuthScreen
          appName="BookForge"
          tagline="Timezone-aware appointment scheduling and public booking pages"
          accentClass="bg-violet-600"
          apiBaseUrl={API_BASE}
          onAuthenticated={(tok, u) => {
            window.localStorage.setItem("bf_token", tok);
            setToken(tok);
            setUser(u);
          }}
        />
      </>
    );
  }

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    if (!svcName.trim()) return;
    await fetch(`${API_BASE}/api/services`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: svcName.trim(),
        duration_minutes: svcDuration,
        buffer_after_minutes: svcBufferAfter,
      }),
    });
    setSvcName("");
    await loadAll();
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) return;
    await fetch(`${API_BASE}/api/staff`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: staffName.trim(),
        email: staffEmail.trim(),
        timezone: staffTz,
        service_ids: services.map((s) => s.id),
      }),
    });
    setStaffName("");
    setStaffEmail("");
    await loadAll();
  }

  async function handleCancelAppointment(id: number) {
    await fetch(`${API_BASE}/api/appointments/${id}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    await loadAll();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader
        currentAppId="bookforge"
        appName="BookForge"
        accentClass="bg-violet-600"
        user={user}
        onLogout={() => {
          window.localStorage.removeItem("bf_token");
          setToken(null);
          setUser(null);
        }}
        rightSlot={
          orgSlug ? (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/?book=${orgSlug}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Public Booking Link"}
            </button>
          ) : null
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          {[
            { id: "appointments", label: "Appointments", icon: CalendarClock },
            { id: "services", label: "Services", icon: Briefcase },
            { id: "staff", label: "Staff & Hours", icon: Users },
            { id: "notifications", label: "Notifications", icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === item.id
                    ? "bg-violet-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </div>

        {tab === "appointments" && (
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" />}
                title="No appointments scheduled"
                description="Configure a service and staff member, then share your public booking link."
              />
            ) : (
              appointments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="font-semibold">
                      {a.customer_name} — {a.service_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      With {a.staff_name} · {a.start_utc}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === "confirmed" ? "success" : "danger"}>
                      {a.status}
                    </Badge>
                    {a.status === "confirmed" && (
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(a.id)}
                        className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "services" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <form
              onSubmit={handleCreateService}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-3"
            >
              <h3 className="text-sm font-bold">New Service</h3>
              <input
                type="text"
                required
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                placeholder="Service name (e.g. Strategy Call)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Duration (min)</label>
                  <input
                    type="number"
                    min={5}
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">After Buffer (min)</label>
                  <input
                    type="number"
                    min={0}
                    value={svcBufferAfter}
                    onChange={(e) => setSvcBufferAfter(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Add Service
              </button>
            </form>

            <div className="space-y-2">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    {s.duration_minutes} min · Buffer after: {s.buffer_after_minutes} min
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "staff" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <form
              onSubmit={handleCreateStaff}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-3"
            >
              <h3 className="text-sm font-bold">Add Staff Member</h3>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                required
                value={staffTz}
                onChange={(e) => setStaffTz(e.target.value)}
                placeholder="IANA Timezone (e.g. America/Chicago)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Add Staff (Mon–Fri 9–5)
              </button>
            </form>

            <div className="space-y-2">
              {staff.map((st) => (
                <div
                  key={st.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="font-semibold">{st.name}</div>
                  <div className="text-xs text-slate-500">
                    {st.email} · {st.timezone}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "notifications" && (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <span className="font-semibold">{n.recipient_email}: </span>
                  {n.message}
                </div>
                <Badge variant="info">{n.event_type}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BookForgeWorkspace />
    </ThemeProvider>
  );
}
