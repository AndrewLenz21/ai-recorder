import { invokeCommand } from "./invoke";

export const windowCommands = {
  showMain: () => invokeCommand<void>("window_show_main"),
  showWidget: () => invokeCommand<void>("window_show_widget"),
  hideWidget: () => invokeCommand<void>("window_hide_widget"),
};
