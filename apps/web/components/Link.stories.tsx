import type { Meta, StoryObj } from "@storybook/react";

import { Link } from "./Link";

const meta: Meta<typeof Link> = {
  title: "Atoms/Link",
  component: Link,
  args: {
    href: "https://summa.vision",
    children: "Visit summa.vision",
  },
};

export default meta;

type Story = StoryObj<typeof Link>;

export const Default: Story = {};

export const WithCustomClass: Story = {
  args: {
    className: "text-primary",
    children: "Primary link",
  },
};
