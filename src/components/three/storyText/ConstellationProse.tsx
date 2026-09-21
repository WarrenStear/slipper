import StoryTextMoment, { type StoryTextMomentProps } from "./StoryTextMoment";

export function ConstellationProse(props: Omit<StoryTextMomentProps, "treatment">) {
  return <StoryTextMoment {...props} treatment="constellation"><i /><i /><i /><i /></StoryTextMoment>;
}
