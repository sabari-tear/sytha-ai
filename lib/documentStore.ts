const store=new Map<string,any[]>();

export function setUserDocuments(userId:string,type:string,docs:any[]){
  store.set(`${type}_${userId}`,docs);
}

export function getUserDocuments(userId:string,type:string){
  return store.get(`${type}_${userId}`)||[];
}
