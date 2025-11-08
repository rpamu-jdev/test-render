--
-- PostgreSQL database dump
--

\restrict QksoISupH8EXk3yBRYdQbO4XleenwO0iYDQ8SlWPmV9M77UWdJekK2Lq4tiQyuM

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6 (Debian 17.6-2.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: sync_agent_to_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_agent_to_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Try to insert the new agent into the users table
    -- The user_id will be the agent's UUID, cast to text
    INSERT INTO public.users (
        user_id, 
        name, 
        email, 
        phone, 
        profile_image_url, 
        created_at, 
        updated_at
    )
    VALUES (
        NEW.agent_id::text,  -- Cast the agent_id (uuid) to text
        NEW.name, 
        NEW.email, 
        NEW.phone, 
        NEW.profile_image_url, 
        NOW(), 
        NOW()
    )
    -- This is the most important part:
    -- If a user already exists with this email, do nothing.
    -- This prevents a "unique constraint violation" error.
    ON CONFLICT (email) DO NOTHING;

    RETURN NEW;
END;
$$;


--
-- Name: sync_vendor_to_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_vendor_to_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Try to insert the new vendor into the users table
    -- The user_id will be the vendor's UUID, cast to text
    INSERT INTO public.users (
        user_id, 
        name, 
        email, 
        phone, 
        profile_image_url, 
        created_at, 
        updated_at
    )
    VALUES (
        NEW.vendor_id::text,  -- Cast the vendor_id (uuid) to text
        COALESCE(NEW.contact_name, NEW.name), -- Use contact_name if available, else vendor name
        NEW.email, 
        NEW.phone, 
        NEW.profile_image_url, -- Map logo_url to profile_image_url
        NOW(), 
        NOW()
    )
    -- If a user already exists with this email, do nothing.
    -- This prevents a "unique constraint violation" error.
    ON CONFLICT (email) DO NOTHING;

    RETURN NEW;
END;
$$;


--
-- Name: update_agent_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE agents
    SET
        review_count = (SELECT COUNT(*) FROM agent_reviews WHERE agent_id = NEW.agent_id),
        average_rating = (SELECT AVG(rating) FROM agent_reviews WHERE agent_id = NEW.agent_id)
    WHERE
        agent_id = NEW.agent_id;
    RETURN NEW;
END;
$$;


--
-- Name: update_vendor_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_vendor_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Use the vendor_id from the changed row (NEW or OLD)
    -- We must use UPDATE...FROM syntax for this
    WITH stats AS (
        SELECT
            AVG(rating) AS avg_rating,
            COUNT(*) AS count
        FROM vendor_reviews
        WHERE vendor_id = COALESCE(NEW.vendor_id, OLD.vendor_id)
    )
    UPDATE vendors
    SET
        review_count = stats.count,
        average_rating = COALESCE(stats.avg_rating, 0.00)
    FROM stats  -- This FROM clause was missing, which caused the error
    WHERE
        vendors.vendor_id = COALESCE(NEW.vendor_id, OLD.vendor_id); -- This is the join condition
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    user_name character varying(64),
    user_id character varying(64),
    property_id uuid,
    rating smallint NOT NULL,
    review_title character varying(255),
    review_body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    agent_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    agency_name character varying(255),
    license_number character varying(100),
    city character varying(100),
    about text,
    profile_image_url text,
    plan_id integer,
    subscription_starts_at timestamp with time zone,
    subscription_expires_at timestamp with time zone,
    subscription_status character varying(20) DEFAULT 'inactive'::character varying,
    average_rating numeric(3,2) DEFAULT 0.00,
    review_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amenities (
    amenity_id integer NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: amenities_amenity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amenities_amenity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amenities_amenity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amenities_amenity_id_seq OWNED BY public.amenities.amenity_id;


--
-- Name: badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges (
    badge_id integer NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: badges_badge_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.badges_badge_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: badges_badge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.badges_badge_id_seq OWNED BY public.badges.badge_id;


--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    last_message_preview text,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id character varying(255) NOT NULL,
    message_body text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    property_id uuid DEFAULT gen_random_uuid() NOT NULL,
    posted_by character varying(64),
    listing_type character varying(64),
    title character varying(255),
    heading character varying(255),
    description text,
    price numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    price_per_sqft numeric(10,2),
    street character varying(255),
    city character varying(100),
    state character varying(100),
    country character varying(100),
    zip_code character varying(10),
    latitude numeric(9,6),
    longitude numeric(9,6),
    property_type character varying(64),
    total_sqft numeric(10,2),
    built_up_sqft numeric(10,2),
    carpet_sqft numeric(10,2),
    plot_sqft numeric(10,2),
    year_built smallint,
    facing character varying(64),
    furnishing character varying(64),
    parking_type character varying(50),
    floor_number smallint,
    total_floors smallint,
    bedrooms smallint,
    bathrooms smallint,
    balconies smallint,
    availability_status character varying(64),
    possession_date date,
    maintenance_charges numeric(10,2),
    views bigint DEFAULT 0,
    status character varying(64) DEFAULT 'available'::character varying NOT NULL,
    seller_name character varying(255),
    seller_phone character varying(20),
    seller_alt_phone character varying(20),
    preferred_contact_time character varying(100),
    allow_in_app_message boolean DEFAULT true,
    allow_in_app_call boolean DEFAULT false,
    allow_whatsapp boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location public.geography(Point,4326)
);


--
-- Name: property_amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_amenities (
    property_id uuid NOT NULL,
    amenity_id integer NOT NULL
);


--
-- Name: property_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_badges (
    property_id uuid NOT NULL,
    badge_id integer NOT NULL
);


--
-- Name: property_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    url text NOT NULL,
    type text NOT NULL,
    display_order smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: property_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    status text NOT NULL,
    changed_on timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    service_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);


--
-- Name: services_service_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.services_service_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: services_service_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.services_service_id_seq OWNED BY public.services.service_id;


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    plan_id integer NOT NULL,
    name character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL,
    duration_days integer NOT NULL,
    features jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_type character varying(32)
);


--
-- Name: subscription_plans_plan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_plans_plan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_plans_plan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_plans_plan_id_seq OWNED BY public.subscription_plans.plan_id;


--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_devices (
    device_id text NOT NULL,
    user_id character varying(64) NOT NULL,
    fcm_token text NOT NULL,
    last_updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_favorites (
    user_id character varying(64) NOT NULL,
    property_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_recently_viewed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_recently_viewed (
    user_id character varying(64) NOT NULL,
    property_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_image_url text
);


--
-- Name: vendor_portfolio_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_portfolio_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    image_url text NOT NULL,
    caption character varying(255),
    display_order smallint DEFAULT 0
);


--
-- Name: vendor_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    user_name character varying(64),
    user_id character varying(64),
    property_id uuid,
    rating smallint NOT NULL,
    review_title character varying(255),
    review_body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vendor_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: vendor_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_services (
    vendor_id uuid NOT NULL,
    service_id integer NOT NULL
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    vendor_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    contact_name character varying(255),
    phone character varying(20) NOT NULL,
    email character varying(255),
    address text,
    about text,
    profile_image_url text,
    average_rating numeric(3,2) DEFAULT 0.00,
    review_count integer DEFAULT 0,
    subscription_plan_id integer,
    subscription_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    city character varying(32)
);


--
-- Name: amenities amenity_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenities ALTER COLUMN amenity_id SET DEFAULT nextval('public.amenities_amenity_id_seq'::regclass);


--
-- Name: badges badge_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges ALTER COLUMN badge_id SET DEFAULT nextval('public.badges_badge_id_seq'::regclass);


--
-- Name: services service_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services ALTER COLUMN service_id SET DEFAULT nextval('public.services_service_id_seq'::regclass);


--
-- Name: subscription_plans plan_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans ALTER COLUMN plan_id SET DEFAULT nextval('public.subscription_plans_plan_id_seq'::regclass);


--
-- Name: agent_reviews agent_reviews_agent_id_user_id_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reviews
    ADD CONSTRAINT agent_reviews_agent_id_user_id_property_id_key UNIQUE (agent_id, user_id, property_id);


--
-- Name: agent_reviews agent_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reviews
    ADD CONSTRAINT agent_reviews_pkey PRIMARY KEY (id);


--
-- Name: agents agents_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_email_key UNIQUE (email);


--
-- Name: agents agents_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_phone_key UNIQUE (phone);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (agent_id);


--
-- Name: amenities amenities_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenities
    ADD CONSTRAINT amenities_name_key UNIQUE (name);


--
-- Name: amenities amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenities
    ADD CONSTRAINT amenities_pkey PRIMARY KEY (amenity_id);


--
-- Name: badges badges_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_name_key UNIQUE (name);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (badge_id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_participants chat_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: chat_participants chat_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (property_id);


--
-- Name: property_amenities property_amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_amenities
    ADD CONSTRAINT property_amenities_pkey PRIMARY KEY (property_id, amenity_id);


--
-- Name: property_badges property_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_badges
    ADD CONSTRAINT property_badges_pkey PRIMARY KEY (property_id, badge_id);


--
-- Name: property_media property_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_media
    ADD CONSTRAINT property_media_pkey PRIMARY KEY (id);


--
-- Name: property_status_history property_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_status_history
    ADD CONSTRAINT property_status_history_pkey PRIMARY KEY (id);


--
-- Name: services services_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_name_key UNIQUE (name);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (service_id);


--
-- Name: subscription_plans subscription_plans_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (plan_id);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (device_id);


--
-- Name: user_favorites user_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorites
    ADD CONSTRAINT user_favorites_pkey PRIMARY KEY (user_id, property_id);


--
-- Name: user_recently_viewed user_recently_viewed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_recently_viewed
    ADD CONSTRAINT user_recently_viewed_pkey PRIMARY KEY (user_id, property_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: vendor_portfolio_images vendor_portfolio_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_portfolio_images
    ADD CONSTRAINT vendor_portfolio_images_pkey PRIMARY KEY (id);


--
-- Name: vendor_reviews vendor_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_reviews
    ADD CONSTRAINT vendor_reviews_pkey PRIMARY KEY (id);


--
-- Name: vendor_reviews vendor_reviews_vendor_id_user_id_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_reviews
    ADD CONSTRAINT vendor_reviews_vendor_id_user_id_property_id_key UNIQUE (vendor_id, user_id, property_id);


--
-- Name: vendor_services vendor_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_services
    ADD CONSTRAINT vendor_services_pkey PRIMARY KEY (vendor_id, service_id);


--
-- Name: vendors vendors_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_email_key UNIQUE (email);


--
-- Name: vendors vendors_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_phone_key UNIQUE (phone);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (vendor_id);


--
-- Name: idx_chat_conversations_last_message_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversations_last_message_at ON public.chat_conversations USING btree (last_message_at);


--
-- Name: idx_chat_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages USING btree (conversation_id);


--
-- Name: idx_chat_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_participants_user_id ON public.chat_participants USING btree (user_id);


--
-- Name: idx_user_devices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_devices_user_id ON public.user_devices USING btree (user_id);


--
-- Name: idx_user_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_favorites_user_id ON public.user_favorites USING btree (user_id);


--
-- Name: idx_user_recently_viewed_user_id_viewed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_recently_viewed_user_id_viewed_at ON public.user_recently_viewed USING btree (user_id, viewed_at DESC);


--
-- Name: agents trg_sync_agent_to_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_agent_to_user AFTER INSERT ON public.agents FOR EACH ROW EXECUTE FUNCTION public.sync_agent_to_user();


--
-- Name: vendors trg_sync_vendor_to_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_vendor_to_user AFTER INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_to_user();


--
-- Name: agent_reviews trg_update_agent_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_agent_rating AFTER INSERT OR DELETE OR UPDATE ON public.agent_reviews FOR EACH ROW EXECUTE FUNCTION public.update_agent_rating();


--
-- Name: vendor_reviews trg_update_vendor_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_vendor_rating AFTER INSERT OR DELETE OR UPDATE ON public.vendor_reviews FOR EACH ROW EXECUTE FUNCTION public.update_vendor_rating();


--
-- Name: agent_reviews agent_reviews_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_reviews
    ADD CONSTRAINT agent_reviews_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(agent_id) ON DELETE CASCADE;


--
-- Name: agents agents_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_participants chat_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_participants
    ADD CONSTRAINT chat_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: user_devices fk_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: property_amenities property_amenities_amenity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_amenities
    ADD CONSTRAINT property_amenities_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenities(amenity_id) ON DELETE CASCADE;


--
-- Name: property_amenities property_amenities_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_amenities
    ADD CONSTRAINT property_amenities_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(property_id) ON DELETE CASCADE;


--
-- Name: property_badges property_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_badges
    ADD CONSTRAINT property_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(badge_id) ON DELETE CASCADE;


--
-- Name: property_badges property_badges_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_badges
    ADD CONSTRAINT property_badges_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(property_id) ON DELETE CASCADE;


--
-- Name: property_media property_media_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_media
    ADD CONSTRAINT property_media_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(property_id) ON DELETE CASCADE;


--
-- Name: property_status_history property_status_history_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_status_history
    ADD CONSTRAINT property_status_history_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(property_id) ON DELETE CASCADE;


--
-- Name: user_favorites user_favorites_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_favorites
    ADD CONSTRAINT user_favorites_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(property_id) ON DELETE CASCADE;


--
-- Name: user_recently_viewed user_recently_viewed_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_recently_viewed
    ADD CONSTRAINT user_recently_viewed_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(property_id) ON DELETE CASCADE;


--
-- Name: vendor_portfolio_images vendor_portfolio_images_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_portfolio_images
    ADD CONSTRAINT vendor_portfolio_images_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id) ON DELETE CASCADE;


--
-- Name: vendor_reviews vendor_reviews_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_reviews
    ADD CONSTRAINT vendor_reviews_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(property_id) ON DELETE SET NULL;


--
-- Name: vendor_reviews vendor_reviews_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_reviews
    ADD CONSTRAINT vendor_reviews_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id) ON DELETE CASCADE;


--
-- Name: vendor_services vendor_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_services
    ADD CONSTRAINT vendor_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(service_id) ON DELETE RESTRICT;


--
-- Name: vendor_services vendor_services_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_services
    ADD CONSTRAINT vendor_services_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id) ON DELETE CASCADE;


--
-- Name: vendors vendors_subscription_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_subscription_plan_id_fkey FOREIGN KEY (subscription_plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- PostgreSQL database dump complete
--

\unrestrict QksoISupH8EXk3yBRYdQbO4XleenwO0iYDQ8SlWPmV9M77UWdJekK2Lq4tiQyuM

