ALTER TABLE "proposals" ADD COLUMN "analysis" JSONB NOT NULL DEFAULT '{}';

UPDATE "audit_templates"
SET "name" = 'Professional Web Audit',
		"description" = 'Audit completo de presencia web, UX, conversión, SEO, performance, accesibilidad y seguridad',
		"sections" = '[
			{"key":"firstImpression","label":"Primera impresión","weight":5,"criteria":[]},
			{"key":"header","label":"Header & Hero","weight":5,"criteria":[]},
			{"key":"home","label":"Home","weight":5,"criteria":[]},
			{"key":"about","label":"About","weight":4,"criteria":[]},
			{"key":"services","label":"Servicios","weight":6,"criteria":[]},
			{"key":"portfolio","label":"Portfolio","weight":5,"criteria":[]},
			{"key":"testimonials","label":"Testimonios","weight":4,"criteria":[]},
			{"key":"faq","label":"FAQ","weight":3,"criteria":[]},
			{"key":"blog","label":"Blog","weight":3,"criteria":[]},
			{"key":"contact","label":"Contacto","weight":6,"criteria":[]},
			{"key":"footer","label":"Footer","weight":3,"criteria":[]},
			{"key":"responsive","label":"Responsive","weight":6,"criteria":[]},
			{"key":"performance","label":"Performance","weight":10,"criteria":[]},
			{"key":"seo","label":"SEO & Visibility","weight":10,"criteria":[]},
			{"key":"accessibility","label":"Accesibilidad","weight":8,"criteria":[]},
			{"key":"security","label":"Seguridad","weight":8,"criteria":[]},
			{"key":"ux","label":"UX","weight":6,"criteria":[]},
			{"key":"conversion","label":"Conversión","weight":8,"criteria":[]},
			{"key":"content","label":"Contenido","weight":8,"criteria":[]}
		]'::jsonb
WHERE "is_default" = true;