import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Activity, ArrowLeft, ArrowRight, CalendarDays, Check, ClipboardList, FileHeart, LogOut, Plus, Search, ShieldCheck, Stethoscope, Users, X } from 'lucide-react';
import { auth, hasRole, initializeAuth } from './auth';
import { api } from './api';
import type { Appointment, AppointmentStatus, AuditEvent, Doctor, MedicalRecord, Patient } from './types';

type View = 'agenda' | 'patients' | 'audit';
const statusLabel: Record<AppointmentStatus, string> = { SCHEDULED: 'Pendiente', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada', COMPLETED: 'Atendida' };
type AgendaPayload = { items: Appointment[]; offline: boolean };

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!import.meta.env.VITE_OIDC_URL || !import.meta.env.VITE_OIDC_REALM || !import.meta.env.VITE_OIDC_CLIENT_ID) {
      setError('Configura el proveedor de identidad en las variables VITE_OIDC_.');
      return;
    }
    initializeAuth().then(setReady).catch(() => setError('No fue posible conectar con el proveedor de identidad.'));
  }, []);
  if (error) return <div className="connect"><div className="mark"><Activity /></div><p className="eyebrow">CLÍNICA HORIZONTE</p><h1>Inicio de sesión no disponible</h1><p>{error}</p><button className="secondary" onClick={() => location.reload()}>Volver a intentar</button></div>;
  if (!ready) return <div className="connect"><div className="mark"><ShieldCheck /></div><h1>Conectando con la clínica</h1><p>Validando tu identidad…</p></div>;
  return <Workspace />;
}

function Workspace() {
  const [view, setView] = useState<View>(() => hasRole('SECURITY_AUDITOR') && !hasRole('ADMIN_STAFF') && !hasRole('HEALTH_PROFESSIONAL') ? 'audit' : 'agenda');
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'patient' | 'appointment' | null>(null);
  const [recordPatient, setRecordPatient] = useState<Patient | null>(null);
  const qc = useQueryClient();
  const admin = hasRole('ADMIN_STAFF');
  const doctor = hasRole('HEALTH_PROFESSIONAL');
  const auditor = hasRole('SECURITY_AUDITOR');
  const appointments = useQuery({
    queryKey: ['appointments', day],
    enabled: view === 'agenda',
    queryFn: async (): Promise<AgendaPayload> => {
      let items: Appointment[];
      try {
        items = await api<Appointment[]>(`/appointments?date=${day}`);
      } catch (error) {
        if (isTauri()) {
          const cached = await invoke<{ day: string; appointments: Appointment[] } | null>('read_cached_agenda', { day });
          if (cached?.day === day) return { items: cached.appointments, offline: true };
        }
        throw error;
      }
      if (isTauri()) await invoke('cache_agenda', { day, appointments: items }).catch(() => undefined);
      return { items, offline: false };
    },
  });
  const patients = useQuery({ queryKey: ['patients'], queryFn: () => api<Patient[]>('/patients'), enabled: view === 'patients' });
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => api<AuditEvent[]>('/audit'), enabled: view === 'audit' });
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => api(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments', day] }),
  });
  const identity = auth.tokenParsed as { name?: string; preferred_username?: string } | undefined;
  const displayName = identity?.name ?? identity?.preferred_username ?? 'Usuario';
  const shownPatients = (patients.data ?? []).filter((p) => `${p.firstName} ${p.lastName} ${p.rut ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const agendaItems = appointments.data?.items ?? [];
  const offline = appointments.data?.offline ?? false;
  const shiftDay = (delta: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + delta); setDay(d.toISOString().slice(0, 10)); };
  async function logout() {
    if (isTauri()) await invoke('clear_agenda_cache').catch(() => undefined);
    await auth.logout();
  }
  useEffect(() => {
    let timer = 0;
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void logout(), 15 * 60_000); };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((name) => window.addEventListener(name, reset));
    reset();
    return () => { window.clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, reset)); };
  }, []);

  return <div className="layout">
    <aside className="sidebar">
      <div className="brand"><span className="mark"><Activity size={20} /></span><span><b>horizonte</b><small>CLÍNICA</small></span></div>
      <p className="nav-caption">GESTIÓN CLÍNICA</p>
      <nav>
        <button className={view === 'agenda' ? 'nav active' : 'nav'} onClick={() => setView('agenda')}><CalendarDays size={18} />Agenda</button>
        {admin || doctor ? <button className={view === 'patients' ? 'nav active' : 'nav'} onClick={() => setView('patients')}><Users size={18} />Pacientes</button> : null}
        {auditor && <button className={view === 'audit' ? 'nav active' : 'nav'} onClick={() => setView('audit')}><ClipboardList size={18} />Auditoría</button>}
      </nav>
      <div className="profile"><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><span className="profile-text"><b>{displayName}</b><small>{admin ? 'Administración' : doctor ? 'Profesional de salud' : 'Auditoría'}</small></span><button className="icon" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => void logout()}><LogOut size={16} /></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><span>Clínica <i>/</i> <b>{view === 'agenda' ? 'Agenda' : view === 'patients' ? 'Pacientes' : 'Auditoría'}</b></span><span className="session"><i />Sesión protegida</span></header>
      <section className="content">
        <div className="page-head"><div><p className="eyebrow">{view === 'agenda' ? 'COORDINACIÓN DIARIA' : view === 'patients' ? 'REGISTRO DE ATENCIÓN' : 'TRAZABILIDAD DEL SISTEMA'}</p><h1>{view === 'agenda' ? 'Agenda' : view === 'patients' ? 'Pacientes' : 'Auditoría'}</h1><p className="sub">{view === 'agenda' ? 'Citas y atención programada' : view === 'patients' ? 'Información de contacto y atención asignada' : 'Eventos registrados de acceso y cambios'}</p></div>
          {admin && view !== 'audit' && <button className="primary" onClick={() => setDialog(view === 'agenda' ? 'appointment' : 'patient')}><Plus size={17} />{view === 'agenda' ? 'Nueva cita' : 'Nuevo paciente'}</button>}
        </div>
        {view === 'agenda' ? <>
          <div className="toolbar"><div className="date-tools"><button className="icon light" aria-label="Día anterior" onClick={() => shiftDay(-1)}><ArrowLeft size={17} /></button><label><CalendarDays size={16} /><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label><button className="icon light" aria-label="Día siguiente" onClick={() => shiftDay(1)}><ArrowRight size={17} /></button><button className="link-button" onClick={() => setDay(new Date().toISOString().slice(0, 10))}>Hoy</button></div><span className="count"><b>{agendaItems.length}</b> citas</span></div>
          {offline && <div className="offline-banner"><ShieldCheck size={16} /> Contingencia · agenda local de solo lectura</div>}
          {appointments.isLoading ? <Loading /> : appointments.error ? <ErrorMessage error={appointments.error} /> : !agendaItems.length ? <Empty icon={<CalendarDays />} title="Sin citas para este día" text="Prueba otra fecha o agenda una nueva cita." /> :
            <div className="schedule">{agendaItems.map((a) => <article className="appointment" key={a.id}>
              <div className="time"><b>{new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(a.scheduledAt))}</b><small>{a.durationMinutes} min</small></div>
              <div className="person"><span className="patient-mark">{a.patient.firstName[0]}{a.patient.lastName[0]}</span><span><b>{a.patient.lastName}, {a.patient.firstName}</b><small>{a.doctor.displayName}</small></span></div>
              <span className={`status ${a.status.toLowerCase()}`}>{statusLabel[a.status]}</span>
              <div className="actions">{!offline && admin && a.status === 'SCHEDULED' && <button className="icon good" title="Confirmar cita" aria-label="Confirmar cita" onClick={() => changeStatus.mutate({ id: a.id, status: 'CONFIRMED' })}><Check size={17} /></button>}{!offline && doctor && !['CANCELLED', 'COMPLETED'].includes(a.status) && <button className="icon good" title="Marcar atendida" aria-label="Marcar atendida" onClick={() => changeStatus.mutate({ id: a.id, status: 'COMPLETED' })}><Stethoscope size={16} /></button>}{!offline && admin && !['CANCELLED', 'COMPLETED'].includes(a.status) && <button className="icon danger" title="Cancelar cita" aria-label="Cancelar cita" onClick={() => changeStatus.mutate({ id: a.id, status: 'CANCELLED' })}><X size={17} /></button>}</div>
            </article>)}</div>}
        </> : view === 'patients' ? <>
          <div className="toolbar patient-toolbar"><label className="search"><Search size={16} /><input placeholder="Buscar por nombre o RUT" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span className="count">{shownPatients.length} registros</span></div>
          {patients.isLoading ? <Loading /> : patients.error ? <ErrorMessage error={patients.error} /> : !shownPatients.length ? <Empty icon={<Users />} title="No hay pacientes para mostrar" text={doctor ? 'Solo aparecen pacientes con atención asignada.' : 'Registra un paciente para comenzar.'} /> :
            <div className="table-wrap"><table><thead><tr><th>Paciente</th>{admin && <><th>RUT</th><th>Contacto</th></>}{doctor && <th>Ficha clínica</th>}</tr></thead><tbody>{shownPatients.map((p) => <tr key={p.id}><td><div className="person"><span className="patient-mark">{p.firstName[0]}{p.lastName[0]}</span><span><b>{p.lastName}, {p.firstName}</b><small>Paciente</small></span></div></td>{admin && <><td>{p.rut}</td><td>{p.contact?.phone ?? p.contact?.email ?? 'Sin contacto'}</td></>}{doctor && <td><button className="table-link" onClick={() => setRecordPatient(p)}><FileHeart size={16} />Abrir ficha</button></td>}</tr>)}</tbody></table></div>}
        </> : <>
          {audit.isLoading ? <Loading /> : audit.error ? <ErrorMessage error={audit.error} /> : !audit.data?.length ? <Empty icon={<ClipboardList />} title="Sin eventos de auditoría" text="Los eventos disponibles aparecerán aquí." /> :
            <div className="table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Evento</th><th>Recurso</th><th>Dirección IP</th></tr></thead><tbody>{audit.data.map((event) => <tr key={event.id}><td>{new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.occurredAt))}</td><td>{event.actorId ?? 'Sistema'}</td><td><span className="audit-event">{event.eventType}</span></td><td>{event.resource}{event.resourceId ? ` · ${event.resourceId}` : ''}</td><td>{event.ipAddress ?? 'No registrada'}</td></tr>)}</tbody></table></div>}
        </>}
      </section>
    </main>
    {dialog === 'patient' && <PatientDialog close={() => setDialog(null)} saved={() => { void qc.invalidateQueries({ queryKey: ['patients'] }); setDialog(null); }} />}
    {dialog === 'appointment' && <AppointmentDialog close={() => setDialog(null)} saved={() => { void qc.invalidateQueries({ queryKey: ['appointments'] }); setDialog(null); }} />}
    {recordPatient && <RecordsDialog patient={recordPatient} close={() => setRecordPatient(null)} />}
  </div>;
}

function PatientDialog({ close, saved }: { close: () => void; saved: () => void }) {
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    try { await api('/patients', { method: 'POST', body: JSON.stringify({ rut: f.get('rut'), firstName: f.get('firstName'), lastName: f.get('lastName'), email: f.get('email') || undefined, phone: f.get('phone') || undefined }) }); saved(); }
    catch (e) { setError((e as Error).message); }
  }
  return <Dialog title="Nuevo paciente" close={close}><form className="form" onSubmit={submit}><Field label="RUT"><input required name="rut" maxLength={20} placeholder="12.345.678-9" /></Field><div className="two"><Field label="Nombre"><input required name="firstName" maxLength={100} /></Field><Field label="Apellido"><input required name="lastName" maxLength={100} /></Field></div><div className="two"><Field label="Correo"><input type="email" name="email" /></Field><Field label="Teléfono"><input type="tel" name="phone" maxLength={30} /></Field></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary">Guardar paciente</button></div></form></Dialog>;
}

function AppointmentDialog({ close, saved }: { close: () => void; saved: () => void }) {
  const patients = useQuery({ queryKey: ['patients'], queryFn: () => api<Patient[]>('/patients') });
  const doctors = useQuery({ queryKey: ['doctors'], queryFn: () => api<Doctor[]>('/users/doctors') });
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    try { await api('/appointments', { method: 'POST', body: JSON.stringify({ patientId: f.get('patientId'), doctorId: f.get('doctorId'), scheduledAt: new Date(String(f.get('scheduledAt'))).toISOString(), durationMinutes: Number(f.get('durationMinutes')) }) }); saved(); }
    catch (e) { setError((e as Error).message); }
  }
  return <Dialog title="Agendar cita" close={close}><form className="form" onSubmit={submit}><Field label="Paciente"><select required name="patientId" defaultValue=""><option value="" disabled>Selecciona paciente</option>{patients.data?.map((p) => <option key={p.id} value={p.id}>{p.lastName}, {p.firstName} · {p.rut}</option>)}</select></Field><Field label="Profesional"><select required name="doctorId" defaultValue=""><option value="" disabled>Selecciona profesional</option>{doctors.data?.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}</select></Field><div className="two"><Field label="Fecha y hora"><input required type="datetime-local" name="scheduledAt" /></Field><Field label="Duración"><select name="durationMinutes" defaultValue="30"><option value="20">20 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></Field></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary" disabled={!patients.data?.length || !doctors.data?.length}>Confirmar cita</button></div></form></Dialog>;
}

function RecordsDialog({ patient, close }: { patient: Patient; close: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [emergency, setEmergency] = useState(false);
  const records = useQuery({ queryKey: ['records', patient.id], queryFn: () => api<MedicalRecord[]>(`/medical-records/patient/${patient.id}`), retry: false });
  const breakGlass = useMutation({ mutationFn: () => api(`/medical-records/patient/${patient.id}/break-glass`, { method: 'POST', body: JSON.stringify({ justification: reason }) }), onSuccess: () => { setEmergency(true); void qc.invalidateQueries({ queryKey: ['records', patient.id] }); } });
  const createRecord = useMutation({ mutationFn: (data: { diagnosis: string; clinicalNotes: string }) => api('/medical-records', { method: 'POST', body: JSON.stringify({ ...data, patientId: patient.id }) }), onSuccess: () => qc.invalidateQueries({ queryKey: ['records', patient.id] }) });
  async function submitRecord(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); await createRecord.mutateAsync({ diagnosis: String(f.get('diagnosis')), clinicalNotes: String(f.get('clinicalNotes')) }); event.currentTarget.reset(); }
  const forbidden = records.error && (records.error.message.includes('403') || records.error.message.toLowerCase().includes('forbidden'));
  return <Dialog title="Ficha clínica" close={close} wide><div className="record-patient"><span className="patient-mark">{patient.firstName[0]}{patient.lastName[0]}</span><b>{patient.lastName}, {patient.firstName}</b><small>Acceso restringido al profesional asignado</small></div>
    {records.isLoading && <Loading />}{records.error && !forbidden && !emergency && <ErrorMessage error={records.error} />}
    {records.data?.map((r) => <article className="record" key={r.id}><small>{new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(r.createdAt))}</small><h3>{r.diagnosis}</h3><p>{r.clinicalNotes}</p></article>)}
    {(forbidden || emergency) && !records.data && <form className="emergency" onSubmit={(e) => { e.preventDefault(); breakGlass.mutate(); }}><p>Fuera de la ventana de atención asignada se requiere justificar el acceso de urgencia. La solicitud queda auditada.</p><Field label="Motivo de urgencia"><textarea required minLength={20} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>{breakGlass.error && <p className="form-error">{(breakGlass.error as Error).message}</p>}<button className="primary" disabled={reason.trim().length < 20 || breakGlass.isPending}>Solicitar acceso de emergencia</button></form>}
    {records.data && !emergency && <form className="record-form" onSubmit={(e) => void submitRecord(e)}><h3>Registrar atención</h3><Field label="Diagnóstico"><input required name="diagnosis" maxLength={3000} /></Field><Field label="Notas clínicas"><textarea required name="clinicalNotes" maxLength={12000} rows={4} /></Field>{createRecord.error && <p className="form-error">{(createRecord.error as Error).message}</p>}<button className="primary">Guardar atención</button></form>}
  </Dialog>;
}

function Dialog({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon" aria-label="Cerrar" onClick={close}><X size={18} /></button></header>{children}</section></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Loading() { return <p className="message">Cargando información protegida…</p>; }
function ErrorMessage({ error }: { error: Error }) { return <p className="error-message"><ShieldCheck size={17} />{error.message}</p>; }
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="empty"><span>{icon}</span><h2>{title}</h2><p>{text}</p></div>; }
