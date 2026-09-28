import { storeWorkTask } from '@/lib/work-tasks/store-work-task'
import {
  renderOfficerAppointmentPack,
  renderOfficerParticularsPack,
  renderOfficerResignationPack,
  type OfficerChangeInput,
} from '@/lib/work-tasks/officer-forms'
import { renderAuditorChangeDocuments, type AuditorChangeInput } from '@/lib/work-tasks/auditor-change'

export function createOfficerResignationTask(companyId: string, input: OfficerChangeInput, userId: string) {
  return renderOfficerResignationPack(input).then(files => storeWorkTask(companyId, 'OFFICER_RESIGNATION', input, userId, files))
}

export function createOfficerAppointmentTask(companyId: string, input: OfficerChangeInput, userId: string) {
  return renderOfficerAppointmentPack(input).then(files => storeWorkTask(companyId, 'OFFICER_APPOINTMENT', input, userId, files))
}

export function createOfficerParticularsTask(companyId: string, input: OfficerChangeInput, userId: string) {
  return renderOfficerParticularsPack(input).then(files => storeWorkTask(companyId, 'OFFICER_PARTICULARS', input, userId, files))
}

export function createAuditorChangeTask(companyId: string, input: AuditorChangeInput, userId: string) {
  return renderAuditorChangeDocuments(input).then(files => storeWorkTask(companyId, 'AUDITOR_CHANGE', input, userId, files))
}
