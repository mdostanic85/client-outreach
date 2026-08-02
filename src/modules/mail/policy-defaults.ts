export type SendPolicy = {
  maxNewPerDay: number;
  weekdaysOnly: boolean;
  maxFollowUps: number;
  /** Days after initial send before follow-up 1 / 2 */
  followUpOffsetsDays: [number, number];
};

export const DEFAULT_SEND_POLICY: SendPolicy = {
  maxNewPerDay: 5,
  weekdaysOnly: true,
  maxFollowUps: 2,
  followUpOffsetsDays: [5, 12],
};
