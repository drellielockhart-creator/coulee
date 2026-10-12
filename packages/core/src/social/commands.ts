import type { CommandOf } from '../command.ts';
export type SocialCommand = CommandOf<'social.answer_request', { requestId: string; accept: boolean }>;
