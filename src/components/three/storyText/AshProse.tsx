import StoryTextMoment, { type StoryTextMomentProps } from "./StoryTextMoment";

export function AshProse(props: Omit<StoryTextMomentProps, "treatment">) {
  return <StoryTextMoment {...props} treatment="ash"><i /><i /><i /></StoryTextMoment>;
}
