-- CreateTable
CREATE TABLE "_salud" (
    "id" SERIAL NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_salud_pkey" PRIMARY KEY ("id")
);
