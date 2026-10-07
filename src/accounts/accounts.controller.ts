import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBasicAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BasicAuthGuard } from '../common/guards/basic-auth.guard';
import { success, ResponseWrapper } from '../common/types/response.types';
import { AccountsService } from './accounts.service';
import { AccountBalanceResponse, PageResponse, TransferHistoryItem } from './account.types';

@ApiTags('Accounts')
@ApiBasicAuth()
@UseGuards(BasicAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(':accountId/balance')
  @ApiOperation({ summary: 'Get account balance' })
  @ApiParam({ name: 'accountId', format: 'uuid' })
  async balance(@Param('accountId') accountId: string): Promise<ResponseWrapper<AccountBalanceResponse>> {
    return success(await this.accounts.balance(accountId));
  }

  @Get(':accountId/transactions')
  @ApiOperation({ summary: 'Get account transaction history' })
  @ApiParam({ name: 'accountId', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async transactions(
    @Param('accountId') accountId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ): Promise<ResponseWrapper<PageResponse<TransferHistoryItem>>> {
    return success(await this.accounts.history(accountId, page, limit));
  }
}
