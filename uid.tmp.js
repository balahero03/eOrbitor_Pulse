const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const u=await p.user.findUnique({where:{email:'admin@eorbitor.com'}});console.log(u.id);await p.$disconnect();})();
