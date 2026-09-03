import { z } from 'zod'

export const elementTypes = ['external', 'process', 'store', 'boundary'] as const
export const strideIds = ['spoofing','tampering','repudiation','information-disclosure','denial-of-service','elevation-of-privilege'] as const
export const statuses = ['open','mitigated','accepted','not-applicable'] as const
export type ElementType = typeof elementTypes[number]
export type StrideId = typeof strideIds[number]
export type ThreatStatus = typeof statuses[number]
export type Rating = '' | 'low' | 'medium' | 'high'
export type ReviewValue = 'not-reviewed' | 'reviewed-no-threat' | 'threat-identified'

export interface ElementMetadata { description:string; technology:string; owner:string; environment:string; authentication:string; authorization:string; internetExposed:boolean; privilegeLevel:string; dataClassification:string; tags:string[]; notes:string }
export interface AtlasNode { id:string; type:ElementType; name:string; position:{x:number;y:number}; size?:{width:number;height:number}; metadata:ElementMetadata; zIndex?:number }
export interface AtlasEdge { id:string; source:string; target:string; label:string; description:string; protocol:string; port:string; authentication:string; encryption:string; dataClassification:string; notes:string; routing?:'smoothstep'|'straight'|'bezier'; waypoints?:{x:number;y:number}[] }
export interface Threat { id:string; displayId:string; elementId:string; title:string; strideCategory:StrideId; status:ThreatStatus; description:string; impact:string; attackScenario:string; remediation:string; residualRisk:string; references:string; tags:string[]; likelihood:Rating; impactRating:Rating; owner:string; dueDate:string; verification:string; notes:string; createdAt:string; updatedAt:string }
export interface ModelMetadata { description:string; scope:string; assumptions:string; inScope:string; outOfScope:string; authors:string; reviewers:string; version:string; tags:string[]; notes:string }
export interface Snapshot { id:string; name:string; createdAt:string; data:string }
export interface ThreatModel { schemaVersion:1; id:string; name:string; metadata:ModelMetadata; viewport:{x:number;y:number;zoom:number}; nodes:AtlasNode[]; edges:AtlasEdge[]; threats:Threat[]; reviewState:Record<string,Partial<Record<StrideId,ReviewValue>>>; nextThreatNumber:number; createdAt:string; updatedAt:string; snapshots:Snapshot[] }

const point=z.object({x:z.number(),y:z.number()}); const metadata=z.object({description:z.string(),technology:z.string(),owner:z.string(),environment:z.string(),authentication:z.string(),authorization:z.string(),internetExposed:z.boolean(),privilegeLevel:z.string(),dataClassification:z.string(),tags:z.array(z.string()),notes:z.string()})
export const modelSchema=z.object({schemaVersion:z.literal(1),id:z.string().min(1),name:z.string().min(1),metadata:z.object({description:z.string(),scope:z.string(),assumptions:z.string(),inScope:z.string(),outOfScope:z.string(),authors:z.string(),reviewers:z.string(),version:z.string(),tags:z.array(z.string()),notes:z.string()}),viewport:z.object({x:z.number(),y:z.number(),zoom:z.number()}),nodes:z.array(z.object({id:z.string(),type:z.enum(elementTypes),name:z.string(),position:point,size:z.object({width:z.number(),height:z.number()}).optional(),metadata,zIndex:z.number().optional()})),edges:z.array(z.object({id:z.string(),source:z.string(),target:z.string(),label:z.string(),description:z.string(),protocol:z.string(),port:z.string(),authentication:z.string(),encryption:z.string(),dataClassification:z.string(),notes:z.string(),routing:z.enum(['smoothstep','straight','bezier']).optional(),waypoints:z.array(point).optional() })),threats:z.array(z.object({id:z.string(),displayId:z.string(),elementId:z.string(),title:z.string(),strideCategory:z.enum(strideIds),status:z.enum(statuses),description:z.string(),impact:z.string(),attackScenario:z.string(),remediation:z.string(),residualRisk:z.string(),references:z.string(),tags:z.array(z.string()),likelihood:z.enum(['','low','medium','high']),impactRating:z.enum(['','low','medium','high']),owner:z.string(),dueDate:z.string(),verification:z.string(),notes:z.string(),createdAt:z.string(),updatedAt:z.string()})),reviewState:z.record(z.string(),z.record(z.string(),z.enum(['not-reviewed','reviewed-no-threat','threat-identified']))),nextThreatNumber:z.number(),createdAt:z.string(),updatedAt:z.string(),snapshots:z.array(z.object({id:z.string(),name:z.string(),createdAt:z.string(),data:z.string()}))})

export const emptyMetadata=():ElementMetadata=>({description:'',technology:'',owner:'',environment:'',authentication:'',authorization:'',internetExposed:false,privilegeLevel:'',dataClassification:'',tags:[],notes:''})
export const risk=(l:Rating,i:Rating):Rating=>{if(!l||!i)return ''; const n={low:1,medium:2,high:3}[l]*{low:1,medium:2,high:3}[i]; return n>=6?'high':n>=3?'medium':'low'}
export const uid=()=>crypto.randomUUID()
