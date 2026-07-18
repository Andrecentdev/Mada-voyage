-- Mada-Brousse 2.0 — données de démo (à exécuter après schema.sql)

INSERT INTO admins (username, password) VALUES ('admin', 'mada2025')
ON CONFLICT (username) DO NOTHING;

INSERT INTO trips (id, departure, destination, departure_time, duration, driver, price, image_url, active) VALUES
('T1','Antananarivo','Toamasina','06:00','6h','Rakoto J.',25000.00,'/images/destinations/toamasina.jpg',true),
('T2','Antananarivo','Mahajanga','05:30','9h','Randria P.',35000.00,'/images/destinations/mahajanga.jpg',true),
('T3','Antananarivo','Fianarantsoa','07:00','7h','Rasoa H.',28000.00,'/images/destinations/fianarantsoa.jpg',true),
('T4','Antananarivo','Antsirabe','08:00','3h','Rabe M.',12000.00,'/images/destinations/antsirabe.jpg',true),
('T5','Antananarivo','Toliara','05:00','14h','Andry S.',45000.00,'/images/destinations/toliara.jpg',true),
('T6','Toamasina','Antananarivo','14:00','6h','Rakoto J.',25000.00,'/images/destinations/antananarivo.jpg',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO promos (code, type, value, active) VALUES
('MADA10','percent',10.00,true),
('BROUSSE2025','fixed',5000.00,true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO drivers (name, phone, usual_route, trips_completed, rating) VALUES
('Rakoto J.','0341234567','Tana → Toamasina',142,4.6),
('Randria P.','0331234567','Tana → Mahajanga',98,4.4),
('Rasoa H.','0321234567','Tana → Fianarantsoa',121,4.8),
('Rabe M.','0341122334','Tana → Antsirabe',210,4.7),
('Andry S.','0331122334','Tana → Toliara',64,4.3)
ON CONFLICT DO NOTHING;
