import type { Preview } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import "../apps/web/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="light">
        <div className="min-h-screen bg-bg p-8 text-fg">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default preview;
