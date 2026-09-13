import { ElMessage } from 'element-plus'
import 'element-plus/theme-chalk/el-message.css'

export const notify = {
  error(message: string): void {
    ElMessage.error({ message, grouping: true, duration: 5000 })
  },
}
