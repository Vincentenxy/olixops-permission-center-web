import { ElMessageBox } from 'element-plus'

// Keep confirmation and cancellation locked until the single submitted action
// completes. Errors remain owned by the HTTP layer or the caller's inline state.
export async function confirmAction(
  options: { title: string; message: string; confirmText: string; danger?: boolean },
  action: () => Promise<void>,
): Promise<void> {
  let running = false
  let failure: unknown
  await ElMessageBox.confirm(options.message, options.title, {
    confirmButtonText: options.confirmText,
    cancelButtonText: '取消',
    customClass: 'vault-confirm-message-box',
    confirmButtonClass: options.danger ? 'vault-delete-confirm-button' : '',
    closeOnClickModal: false,
    beforeClose: (kind, instance, done) => {
      if (running) return
      if (kind !== 'confirm') {
        done()
        return
      }
      running = true
      instance.confirmButtonLoading = true
      instance.cancelButtonLoading = true
      void action()
        .catch((error: unknown) => {
          failure = error
        })
        .finally(() => {
          running = false
          instance.confirmButtonLoading = false
          instance.cancelButtonLoading = false
          done()
        })
    },
  })
  if (failure) throw failure
}
