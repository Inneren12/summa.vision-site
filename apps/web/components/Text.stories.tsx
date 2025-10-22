import type { Meta, StoryObj } from "@storybook/react";

import { Text } from "./Text";

const meta: Meta<typeof Text> = {
  title: "Atoms/Text",
  component: Text,
  args: {
    children: "Body copy with baseline styles.",
  },
};

export default meta;

type Story = StoryObj<typeof Text>;

export const Paragraph: Story = {};

export const Small: Story = {
  args: {
    className: "text-sm",
    children: "Smaller helper text",
  },
};

export const Heading: Story = {
  render: () => (
    <Text as="h2" className="text-2xl font-semibold">
      Heading via Text
    </Text>
  ),
};
