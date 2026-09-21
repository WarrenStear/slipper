import StoryTextMoment, { type StoryTextMomentProps } from "./StoryTextMoment";

export function WaterProse(props: Omit<StoryTextMomentProps, "treatment">) {
  return <StoryTextMoment {...props} treatment="water"><i /><i /><i /></StoryTextMoment>;
}
