import { Body, Controller, Get, Headers, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBasicAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { BasicAuthGuard } from '../common/guards/basic-auth.guard';
import { CreateTransferDto } from './transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('Transfers')
@ApiBasicAuth()
@UseGuards(BasicAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transfer' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(@Body() request: CreateTransferDto, @Headers('idempotency-key') key: string | undefined, @Res({ passthrough: true }) response: Response) {
    const result = await this.transfers.create(request, key);
    response.statusCode = result.status;
    return result.result;
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Get a transfer by reference' })
  async get(@Param('reference') reference: string) {
    return this.transfers.get(reference);
  }
}
