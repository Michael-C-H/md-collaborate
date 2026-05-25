/**
 * Database 模块：全局可注入的 Drizzle client
 * by AI.Coding
 */
import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DRIZZLE_TOKEN } from './database.tokens'
import { createDrizzleClient } from './drizzle.client'
import type { AppConfig } from '../config/app-config.schema'

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_TOKEN,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<AppConfig, true>) => {
        const url = config.get('DATABASE_URL', { infer: true })
        return createDrizzleClient(url)
      },
    },
  ],
  exports: [DRIZZLE_TOKEN],
})
export class DatabaseModule {}
