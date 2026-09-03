import { Database, UserRound, Box, Shield } from 'lucide-react'; import type { ElementType } from '../domain'
export const TypeIcon=({type,size=18}:{type:ElementType,size?:number})=>type==='external'?<UserRound size={size}/>:type==='store'?<Database size={size}/>:type==='boundary'?<Shield size={size}/>:<Box size={size}/>
export const typeName:Record<ElementType,string>={external:'External Entity',process:'Process',store:'Data Store',boundary:'Trust Boundary'}
