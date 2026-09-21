import StoryTextMoment, { type StoryTextMomentProps } from "./StoryTextMoment";

export function ReflectedProse(props: Omit<StoryTextMomentProps, "treatment">) {
  return <StoryTextMoment {...props} treatment="reflected"><i /><i /><i /></StoryTextMoment>;
}
