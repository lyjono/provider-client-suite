-- Reset provider subscription for testing
UPDATE providers 
SET subscription_tier = 'free', 
    subscription_end_date = NULL, 
    stripe_customer_id = NULL 
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1);