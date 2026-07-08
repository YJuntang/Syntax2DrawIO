export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'warning' | 'danger';
  dontAskAgainLabel?: string;
}

export interface ConfirmationResponse {
  confirmed: boolean;
  dontAskAgain: boolean;
}

type ConfirmationHandler = (request: ConfirmationRequest) => Promise<ConfirmationResponse>;

let confirmationHandler: ConfirmationHandler | null = null;

export function setConfirmationHandler(handler: ConfirmationHandler | null) {
  confirmationHandler = handler;

  return () => {
    if (confirmationHandler === handler) {
      confirmationHandler = null;
    }
  };
}

export async function requestConfirmation(request: ConfirmationRequest) {
  if (!confirmationHandler) {
    return null;
  }

  return confirmationHandler(request);
}
