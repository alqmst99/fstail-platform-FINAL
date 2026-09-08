import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDailyTaskDto, UpdateDailyTaskDto, QueryDailyTasksDto } from './dto/daily-task.dto';

@Injectable()
export class DailyTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDailyTaskDto, workspaceId: string) {
    return this.prisma.dailyTask.create({
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
    // Normalizar a día
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.prisma.dailyTask.findMany({
      where: {
        workspaceId,
        userTag: query.userTag,
        date: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateDailyTaskDto) {
    const task = await this.prisma.dailyTask.findFirst({
      where: { id, workspaceId },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.dailyTask.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, workspaceId: string) {
    const task = await this.prisma.dailyTask.findFirst({
      where: { id, workspaceId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.dailyTask.delete({ where: { id } });
  }

  /**
   * Construye el JSON de contexto para el Prompt-Hub de rutina diaria.
   */
  async buildRoutineContext(workspaceId: string, userTag: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [tasks, activeApps, stats] = await Promise.all([
      this.prisma.dailyTask.findMany({
        where: { workspaceId, userTag, date: { gte: today } },
      }),
      this.prisma.application.count({
        where: {
          workspaceId,
          assignedToUserTag: userTag,
          status: { in: ['POSTULADO', 'EN_CONVERSACION'] },
        },
      }),
      this.prisma.application.groupBy({
        by: ['status'],
        where: { workspaceId, assignedToUserTag: userTag },
        _count: true,
      }),
    ]);

    const total = stats.reduce((acc, s) => acc + s._count, 0);
    const won = stats.find((s) => s.status === 'ADJUDICADO_A_MIME')?._count ?? 0;
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

    const latestEnergy = tasks
      .filter((t) => t.energyLevel != null)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.energyLevel ?? 3;

    return {
      userTag,
      energyLevel: latestEnergy,
      pendingTasks: tasks.filter((t) => !t.completed).map((t) => ({
        title: t.title,
        category: t.category,
        timeSpentMin: t.timeSpentMin,
      })),
      activeChats: activeApps,
      conversionRate: `${conversionRate}%`,
      date: today.toISOString().slice(0, 10),
    };
  }
}
