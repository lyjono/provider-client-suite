-- Reset specific provider subscription for testing
UPDATE providers 
SET subscription_tier = 'free', 
    subscription_end_date = NULL, 
    stripe_customer_id = NULL 
WHERE email = 'joaolages03+provider@gmail.com';