import StoryTextMoment, { type StoryTextMomentProps } from "./StoryTextMoment";

export function AmbientProse(props: Omit<StoryTextMomentProps, "treatment">) {
  return <StoryTextMoment {...props} treatment="ambient"><i /><i /></StoryTextMoment>;
}
