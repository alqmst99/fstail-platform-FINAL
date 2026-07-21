import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CRM',
};

export default function CrmPage() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-semibold text-surface-50">CRM</h1>
        <p className="text-surface-400 mt-2">
          Gestión de clientes y proyectos
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-surface-900 p-6 border border-surface-700">
          <div className="text-sm text-surface-400">Clientes Activos</div>
          <div className="text-4xl font-semibold text-white mt-3">24</div>
          <div className="text-emerald-400 text-sm mt-1">+3 este mes</div>
        </div>

        <div className="rounded-2xl bg-surface-900 p-6 border border-surface-700">
          <div className="text-sm text-surface-400">Proyectos en Curso</div>
          <div className="text-4xl font-semibold text-white mt-3">12</div>
          <div className="text-amber-400 text-sm mt-1">2 por entregar</div>
        </div>

        <div className="rounded-2xl bg-surface-900 p-6 border border-surface-700">
          <div className="text-sm text-surface-400">Auditorías Pendientes</div>
          <div className="text-4xl font-semibold text-white mt-3">7</div>
          <div className="text-surface-400 text-sm mt-1">de 31 totales</div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clientes */}
        <Link
          href="/crm/clients"
          className="group rounded-3xl bg-surface-900 p-8 border border-surface-700 hover:border-gold-500 transition-all duration-200 flex flex-col"
        >
          <div className="text-2xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-surface-100 group-hover:text-gold-400">
            Clientes
          </h3>
          <p className="text-surface-400 mt-2 flex-1">
            Gestioná tus clientes, contactos y estado de relación.
          </p>
          <div className="text-gold-500 text-sm font-medium mt-6 group-hover:translate-x-1 transition">
            Ver todos los clientes →
          </div>
        </Link>

        {/* Proyectos */}
        <Link
          href="/crm/projects"
          className="group rounded-3xl bg-surface-900 p-8 border border-surface-700 hover:border-gold-500 transition-all duration-200 flex flex-col"
        >
          <div className="text-2xl mb-4">📂</div>
          <h3 className="text-xl font-semibold text-surface-100 group-hover:text-gold-400">
            Proyectos
          </h3>
          <p className="text-surface-400 mt-2 flex-1">
            Seguimiento de proyectos activos y entregables.
          </p>
          <div className="text-gold-500 text-sm font-medium mt-6 group-hover:translate-x-1 transition">
            Ver todos los proyectos →
          </div>
        </Link>
      </div>

      <div className="text-center text-surface-500 text-sm pt-8">
        Más funcionalidades de CRM (oportunidades, pipeline, etc.) vendrán en próximas fases.
      </div>
    </div>
  );
}