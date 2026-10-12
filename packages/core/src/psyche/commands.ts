import type { CommandOf } from '../command.ts';
import type { AgencyMode, StandingOrders } from './agency.ts';
export type PsycheCommand = CommandOf<'core.standing_orders', { agencyMode?: AgencyMode; orders: StandingOrders }>;
