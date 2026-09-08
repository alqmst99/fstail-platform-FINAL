import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDailyTaskDto, UpdateDailyTaskDto, QueryDailyTasksDto } from './dto/daily-task.dto';

@Injectable()
export class DailyTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma as PrismaService & {
      dailyTask: any;
      application: any;
    };
  }

  async create(dto: CreateDailyTaskDto, workspaceId: string) {
    return this.db.dailyTask.create({
      data: {
        workspaceId,
        userTag: dto.userTag,
        title: dto.title,
        category: dto.category,
        timeSpentMin: dto.timeSpentMin ?? 0,
        date: dto.date ? new Date(dto.date) : new Date(),
        energyLevel: dto.energyLevel,
        notes: dto.notes,
      },
    });
  }

  async findByUserAndDate(workspaceId: string, query: QueryDailyTasksDto) {
    const date = query.date ? new Date(query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.db.dailyTask.findMany({
      where: {
        workspaceId,
        userTag: query.userTag,
        date: { gte: start, lte: end },
      },
      orderBy: { id: 'asc' },
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateDailyTaskDto) {
    const task = await this.db.dailyTask.findFirst({
      where: { id, workspaceId },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.db.dailyTask.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, workspaceId: string) {
    const task = await this.db.dailyTask.findFirst({
      where: { id, workspaceId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.db.dailyTask.delete({ where: { id } });
  }

  async buildRoutineContext(workspaceId: string, userTag: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [tasks, activeApps, stats] = await Promise.all([
      this.db.dailyTask.findMany({
        where: { workspaceId, userTag, date: { gte: today } },
      }) as Promise<Array<{ title: string; category: string; completed: boolean; timeSpentMin: number; energyLevel: number | null; date: Date }>>,
      this.db.application.count({
        where: {
          workspaceId,
          assignedToUserTag: userTag,
          status: { in: ['POSTULADO', 'EN_CONVERSACION'] },
        },
      }) as Promise<number>,
      this.db.application.groupBy({
        by: ['status'],
        where: { workspaceId, assignedToUserTag: userTag },
        _count: true,
      }) as Promise<Array<{ status: string; _count: number }>>,
    ]);

    const total = stats.reduce((acc: number, s: { _count: number }) => acc + s._count, 0);
    const won = stats.find((s: { status: string }) => s.status === 'ADJUDICADO_A_MIME')?._count ?? 0;
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

    const latestEnergy =
      tasks
        .filter((t) => t.energyLevel != null)
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.energyLevel ?? 3;

    return {
      userTag,
      energyLevel: latestEnergy,
      pendingTasks: tasks
        .filter((t) => !t.completed)
        .map((t) => ({
          title: t.title,
          category: t.category,
          timeSpentMin: t.timeSpentMin,
        })),
      activeChats: activeApps,
      conversionRate: `${conversionRate}%`,
      date: today.toISOString().slice(0, 10),
    };
  }

  /**
   * Carga una rutina generada por IA.
   * body.tasks: [{ title, category?, timeSpentMin? }]
   * Reemplaza o agrega tareas del día para userTag.
   */
  async importRoutine(
    workspaceId: string,
    payload: {
      userTag: string;
      tasks: Array<{ title: string; category?: string; timeSpentMin?: number }>;
      energyLevel?: number;
      replaceToday?: boolean;
      date?: string;
    },
  ) {
    const userTag = payload.userTag || 'Dev1';
    const day = payload.date ? new Date(payload.date) : new Date();
    day.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    if (payload.replaceToday) {
      await this.db.dailyTask.deleteMany({
        where: {
          workspaceId,
          userTag,
          date: { gte: day, lte: end },
        },
      });
    }

    const created = [];
    for (const t of payload.tasks || []) {
      if (!t.title?.trim()) continue;
      const row = await this.db.dailyTask.create({
        data: {
          workspaceId,
          userTag,
          title: t.title.trim(),
          category: t.category || 'DESARROLLO',
          timeSpentMin: t.timeSpentMin ?? 0,
          date: day,
          energyLevel: payload.energyLevel,
          completed: false,
        },
      });
      created.push(row);
    }

    return { imported: created.length, tasks: created };
  }



  /** Tareas entre fromDate y toDate (inclusive), ISO yyyy-mm-dd */
  async findByRange(
    workspaceId: string,
    query: { userTag: string; from: string; to: string },
  ) {
    const start = new Date(query.from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(query.to);
    end.setHours(23, 59, 59, 999);

    return this.db.dailyTask.findMany({
      where: {
        workspaceId,
        userTag: query.userTag,
        date: { gte: start, lte: end },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Carga rutina de TODA la semana de una.
   * tasks: [{ title, category?, timeSpentMin?, date?: 'YYYY-MM-DD' }]
   * o days: { '2026-09-08': [{ title, category? }], ... }
   */
  async importRoutineWeek(
    workspaceId: string,
    payload: {
      userTag: string;
      tasks?: Array<{
        title: string;
        category?: string;
        timeSpentMin?: number;
        date?: string;
      }>;
      days?: Record<
        string,
        Array<{ title: string; category?: string; timeSpentMin?: number }>
      >;
      energyLevel?: number;
      replaceWeek?: boolean;
      weekStart?: string; // lunes ISO
    },
  ) {
    const userTag = payload.userTag || 'Dev1';

    // Normalizar a lista { title, category, timeSpentMin, date }
    const flat: Array<{
      title: string;
      category?: string;
      timeSpentMin?: number;
      date: string;
    }> = [];

    if (payload.days && typeof payload.days === 'object') {
      for (const [date, list] of Object.entries(payload.days)) {
        for (const t of list || []) {
          if (!t?.title?.trim()) continue;
          flat.push({
            title: t.title.trim(),
            category: t.category,
            timeSpentMin: t.timeSpentMin,
            date,
          });
        }
      }
    }

    for (const t of payload.tasks || []) {
      if (!t?.title?.trim()) continue;
      const date =
        t.date ||
        payload.weekStart ||
        new Date().toISOString().slice(0, 10);
      flat.push({
        title: t.title.trim(),
        category: t.category,
        timeSpentMin: t.timeSpentMin,
        date,
      });
    }

    if (!flat.length) {
      return { imported: 0, tasks: [] };
    }

    const dates = [...new Set(flat.map((t) => t.date))];

    if (payload.replaceWeek !== false) {
      for (const d of dates) {
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        const end = new Date(day);
        end.setHours(23, 59, 59, 999);
        await this.db.dailyTask.deleteMany({
          where: {
            workspaceId,
            userTag,
            date: { gte: day, lte: end },
          },
        });
      }
    }

    const created = [];
    for (const t of flat) {
      const day = new Date(t.date);
      day.setHours(12, 0, 0, 0); // mediodía evita shift TZ
      const row = await this.db.dailyTask.create({
        data: {
          workspaceId,
          userTag,
          title: t.title,
          category: t.category || 'DESARROLLO',
          timeSpentMin: t.timeSpentMin ?? 0,
          date: day,
          energyLevel: payload.energyLevel,
          completed: false,
        },
      });
      created.push(row);
    }

    return { imported: created.length, dates, tasks: created };
  }

}
