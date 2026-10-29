import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

/** Dropdown lists for the website (religions, communities, languages…). */
@Controller('masters')
export class MastersController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  async all() {
    const items = await this.prisma.masterItem.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { value: 'asc' }],
      select: { type: true, value: true, parent: true },
    });
    const grouped: Record<string, { value: string; parent: string | null }[]> = {};
    for (const it of items) (grouped[it.type] ??= []).push({ value: it.value, parent: it.parent });
    return grouped;
  }
}
