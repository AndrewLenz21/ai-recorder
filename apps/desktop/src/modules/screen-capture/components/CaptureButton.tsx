import { Button } from "@/shared/components/Button";
import { IconButton } from "@/shared/components/IconButton";
import { CaptureIcon } from "@/shared/components/icons";

import { useScreenCapture } from "../hooks/useScreenCapture";

type Props = {
  compact?: boolean;
};

export function CaptureButton({ compact = false }: Props) {
  const { take } = useScreenCapture();

  if (compact) {
    return (
      <IconButton label="Screenshot" onClick={() => void take()}>
        <CaptureIcon />
      </IconButton>
    );
  }

  return (
    <Button variant="secondary" onClick={() => void take()}>
      <CaptureIcon />
      Screenshot
    </Button>
  );
}
