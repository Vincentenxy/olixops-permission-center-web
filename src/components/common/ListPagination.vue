<script setup lang="ts">
import { ElPagination } from 'element-plus'
import type { PagedList } from '../../composables/use-paged-list'
defineProps<{
  pager: Pick<
    PagedList<unknown>,
    'total' | 'pageNum' | 'pageSize' | 'loading' | 'changePage' | 'changePageSize'
  >
}>()
</script>

<template>
  <ElPagination
    class="table-pagination"
    :current-page="pager.pageNum.value"
    :page-size="pager.pageSize.value"
    :total="pager.total.value"
    :page-sizes="[20, 50, 100, 200]"
    :disabled="pager.loading.value"
    layout="total, prev, pager, next, sizes"
    @current-change="pager.changePage"
    @size-change="pager.changePageSize"
  />
</template>
